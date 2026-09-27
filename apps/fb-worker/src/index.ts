import express from 'express';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from './config.js';

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
  const job = await queue.add('publish', req.body, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 120000 },
    removeOnComplete: 100,
    removeOnFail: 100
  });

  res.status(202).json({
    id: job.id,
    status: 'QUEUED'
  });
});

app.listen(config.port, () => {
  console.log(`fb-worker API listening on http://localhost:${config.port}`);
});
