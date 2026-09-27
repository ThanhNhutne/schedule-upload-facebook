import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

export type JobLogEvent = {
  timestamp?: string;
  event: string;
  jobId?: string;
  targetType?: string;
  status?: string;
  message?: string;
  data?: unknown;
};

export async function appendJobLog(event: JobLogEvent): Promise<void> {
  await mkdir(config.logDir, { recursive: true });
  const file = path.join(config.logDir, 'jobs.jsonl');
  const line = JSON.stringify({
    timestamp: event.timestamp || new Date().toISOString(),
    ...event,
  });
  await appendFile(file, `${line}\n`, 'utf8');
}
