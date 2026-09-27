import express from 'express';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from './config.js';
import { validateFacebookGroupJob } from './job-validation.js';

const app = express();
app.use(express.json());

const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
const queue = new Queue('facebook-publish', { connection: redis });

app.get('/health', async (_req, res) => {
  try {
    const redisStatus = await redis.ping();
    res.json({
      ok: true,
      service: 'fb-worker-api',
      redis: redisStatus,
      postizBaseUrl: config.postizBaseUrl
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post('/api/v1/jobs', async (req, res) => {
  try {
    const payload = validateFacebookGroupJob(req.body);
    const job = await queue.add('publish', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 120000 },
      removeOnComplete: 100,
      removeOnFail: 100
    });

    res.status(202).json({
      id: job.id,
      status: 'QUEUED'
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get('/api/v1/jobs/:id', async (req, res) => {
  const job = await queue.getJob(req.params.id);

  if (!job) {
    res.status(404).json({ error: 'Job not found.' });
    return;
  }

  const state = await job.getState();

  res.json({
    id: job.id,
    state,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason || null,
    returnvalue: job.returnvalue ?? null,
    data: job.data
  });
});

app.listen(config.port, () => {
  console.log(`fb-worker API listening on http://localhost:${config.port}`);
});
