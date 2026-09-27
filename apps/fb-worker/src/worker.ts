import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { BrowserContext } from 'playwright';
import {
  closePersistentFacebookContext,
  openPersistentFacebookContext,
} from './browser.js';
import { config } from './config.js';
import {
  ManualActionRequiredError,
  PermanentAutomationError,
} from './errors.js';
import {
  publishFacebookGroupPost,
  saveFailureScreenshot,
} from './facebook/group-publisher.js';
import { publishFacebookMarketplaceListing } from './facebook/marketplace-publisher.js';
import { validateFacebookJob } from './job-validation.js';
import { appendJobLog } from './logger.js';

let browserContext: BrowserContext | undefined;

async function getBrowserContext(): Promise<BrowserContext> {
  if (browserContext) {
    return browserContext;
  }

  const context =
    await openPersistentFacebookContext(
      'worker',
    );

  browserContext = context;

  context.once('close', () => {
    if (browserContext === context) {
      browserContext = undefined;
    }
  });

  return context;
}

export async function closeFacebookBrowser(): Promise<void> {
  const context = browserContext;

  if (!context) {
    return;
  }

  browserContext = undefined;

  await closePersistentFacebookContext(
    context,
  );
}

async function processFacebookJob(
  job: Job,
): Promise<unknown> {
  const input =
    validateFacebookJob(job.data);

  let context:
    | BrowserContext
    | undefined;

  try {
    context =
      await getBrowserContext();

    await appendJobLog({
      event: 'PROCESSING',
      jobId: String(
        job.id ?? '',
      ),
      targetType:
        input.targetType,
      status: 'PROCESSING',
    });

    if (
      input.targetType ===
      'facebook_group'
    ) {
      return await publishFacebookGroupPost(
        context,
        input,
      );
    }

    return await publishFacebookMarketplaceListing(
      context,
      input,
    );
  } catch (error) {
    const screenshot =
      context
        ? await saveFailureScreenshot(
            context.pages()[0],
            config.screenshotDir,
            String(
              job.id ??
                'unknown',
            ),
          )
        : undefined;

    const requiresManualAction =
      error instanceof
      ManualActionRequiredError;

    const isPermanent =
      requiresManualAction ||
      error instanceof
        PermanentAutomationError;

    if (isPermanent) {
      await job.discard();
    }

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    await appendJobLog({
      event:
        requiresManualAction
          ? 'MANUAL_ACTION_REQUIRED'
          : 'FAILED',
      jobId: String(
        job.id ?? '',
      ),
      targetType:
        input.targetType,
      status: 'FAILED',
      message,
      data: screenshot
        ? { screenshot }
        : undefined,
    });

    throw new Error(
      screenshot
        ? `${message} | screenshot=${screenshot}`
        : message,
    );
  }
}

export function startFacebookWorker(): Worker {
  const redis = new Redis(
    config.redisUrl,
    {
      maxRetriesPerRequest:
        null,
    },
  );

  const worker = new Worker(
    'facebook-publish',
    processFacebookJob,
    {
      connection: redis,
      concurrency: 1,
    },
  );

  worker.on(
    'ready',
    () => {
      console.log(
        'facebook worker ready',
      );
    },
  );

  worker.on(
    'completed',
    (job, result) => {
      console.log(
        `job ${job.id} completed`,
        result,
      );

      void appendJobLog({
        event: 'POSTED',
        jobId: String(
          job.id ?? '',
        ),
        targetType:
          job.data?.targetType,
        status: 'POSTED',
        data: result,
      });
    },
  );

  worker.on(
    'failed',
    (job, error) => {
      console.error(
        `job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    },
  );

  return worker;
}
