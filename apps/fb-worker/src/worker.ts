import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { BrowserContext } from 'playwright';
import { openPersistentFacebookContext } from './browser.js';
import { config } from './config.js';
import { ManualActionRequiredError } from './errors.js';
import {
  publishFacebookGroupTextPost,
  saveFailureScreenshot,
} from './facebook/group-publisher.js';
import { validateFacebookGroupJob } from './job-validation.js';

let browserContext: BrowserContext | undefined;

async function getBrowserContext(): Promise<BrowserContext> {
  if (!browserContext) {
    browserContext = await openPersistentFacebookContext();
  }
  return browserContext;
}

async function processFacebookJob(job: Job): Promise<unknown> {
  const input = validateFacebookGroupJob(job.data);
  const context = await getBrowserContext();

  try {
    return await publishFacebookGroupTextPost(context, input);
  } catch (error) {
    const page = context.pages()[0];
    const screenshot = await saveFailureScreenshot(
      page,
      config.screenshotDir,
      String(job.id ?? 'unknown'),
    );

    if (error instanceof ManualActionRequiredError) {
      await job.discard();
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(screenshot ? `${message} | screenshot=${screenshot}` : message);
  }
}

export function startFacebookWorker(): Worker {
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker('facebook-publish', processFacebookJob, {
    connection: redis,
    concurrency: 1,
  });

  worker.on('ready', () => {
    console.log('facebook worker ready');
  });

  worker.on('completed', (job, result) => {
    console.log(`job ${job.id} completed`, result);
  });

  worker.on('failed', (job, error) => {
    console.error(`job ${job?.id ?? 'unknown'} failed: ${error.message}`);
  });

  return worker;
}
