import type { JobsOptions, Queue } from 'bullmq';
import type { FacebookPublishJob } from './types.js';

export function buildJobOptions(
  job: FacebookPublishJob,
): JobsOptions {
  const scheduledAt = job.scheduledAt
    ? Date.parse(job.scheduledAt)
    : 0;

  const delay = scheduledAt
    ? Math.max(0, scheduledAt - Date.now())
    : 0;

  return {
    delay,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 120_000,
    },
    removeOnComplete: 100,
    removeOnFail: 100,
  };
}

export async function enqueueAutomationJob(
  queue: Queue,
  job: FacebookPublishJob,
) {
  return queue.add(
    'publish',
    job,
    buildJobOptions(job),
  );
}
