import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { BrowserContext } from 'playwright';
import { openPersistentFacebookContext } from './browser.js';
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
  if (!browserContext) {
    browserContext =
      await openPersistentFacebookContext();
  }

  return browserContext;
}

export async function closeFacebookBrowser(): Promise<void> {
  if (!browserContext) return;

  await browserContext.close();
  browserContext = undefined;
}

async function processFacebookJob(
  job: Job,
): Promise<unknown> {
  const input =
    validateFacebookJob(job.data);

  const context =
    await getBrowserContext();

  await appendJobLog({
    event: 'PROCESSING',
    jobId:
      String(job.id ?? ''),
    targetType:
      input.targetType,
    status: 'PROCESSING',
  });

  try {
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
    const page =
      context.pages()[0];

    const screenshot =
      await saveFailureScreenshot(
        page,
        config.screenshotDir,
        String(
          job.id ?? 'unknown',
        ),
      );

    if (
      error instanceof
        ManualActionRequiredError ||
      error instanceof
        PermanentAutomationError
    ) {
      await job.discard();
    }

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    await appendJobLog({
      event:
        error instanceof
        ManualActionRequiredError
          ? 'MANUAL_ACTION_REQUIRED'
          : 'FAILED',
      jobId:
        String(job.id ?? ''),
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
      maxRetriesPerRequest: null,
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
        jobId:
          String(job.id ?? ''),
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
