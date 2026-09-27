import express from 'express';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from './config.js';
import { validateFacebookJob } from './job-validation.js';
import { enqueueAutomationJob } from './queue.js';
import { PostizClient } from './postiz/client.js';
import {
  syncPostizMappings,
  type PostizTargetMapping,
} from './postiz/adapter.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

const redis = new Redis(
  config.redisUrl,
  {
    maxRetriesPerRequest: null,
  },
);

const queue = new Queue(
  'facebook-publish',
  {
    connection: redis,
  },
);

app.use(
  '/api/v1',
  (req, res, next) => {
    if (!config.automationApiToken) {
      next();
      return;
    }

    const authorization =
      req.header('authorization') || '';

    if (
      authorization !==
      `Bearer ${config.automationApiToken}`
    ) {
      res
        .status(401)
        .json({ error: 'Unauthorized' });
      return;
    }

    next();
  },
);

app.get(
  '/health',
  async (_req, res) => {
    try {
      const redisStatus =
        await redis.ping();

      res.json({
        ok: true,
        service: 'fb-worker-api',
        redis: redisStatus,
        postizBaseUrl:
          config.postizBaseUrl,
      });
    } catch (error) {
      res.status(503).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  },
);

app.post(
  '/api/v1/jobs',
  async (req, res) => {
    try {
      const payload =
        validateFacebookJob(req.body);

      const job =
        await enqueueAutomationJob(
          queue,
          payload,
        );

      res.status(202).json({
        id: job.id,
        status:
          payload.scheduledAt &&
          Date.parse(payload.scheduledAt) >
            Date.now()
            ? 'SCHEDULED'
            : 'QUEUED',
      });
    } catch (error) {
      res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  },
);

app.get(
  '/api/v1/jobs/:id',
  async (req, res) => {
    const job = await queue.getJob(
      req.params.id,
    );

    if (!job) {
      res
        .status(404)
        .json({
          error: 'Job not found.',
        });
      return;
    }

    const state =
      await job.getState();

    res.json({
      id: job.id,
      state,
      attemptsMade:
        job.attemptsMade,
      failedReason:
        job.failedReason || null,
      returnvalue:
        job.returnvalue ?? null,
      data: job.data,
    });
  },
);

app.post(
  '/api/v1/jobs/:id/retry',
  async (req, res) => {
    const job = await queue.getJob(
      req.params.id,
    );

    if (!job) {
      res
        .status(404)
        .json({
          error: 'Job not found.',
        });
      return;
    }

    try {
      await job.retry('failed');

      res.json({
        id: job.id,
        status: 'QUEUED',
      });
    } catch (error) {
      res.status(409).json({
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  },
);

app.delete(
  '/api/v1/jobs/:id',
  async (req, res) => {
    const job = await queue.getJob(
      req.params.id,
    );

    if (!job) {
      res
        .status(404)
        .json({
          error: 'Job not found.',
        });
      return;
    }

    try {
      await job.remove();

      res.json({
        id: job.id,
        status: 'CANCELLED',
      });
    } catch (error) {
      res.status(409).json({
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  },
);

app.post(
  '/api/v1/postiz/sync',
  async (req, res) => {
    if (!config.postizApiToken) {
      res.status(503).json({
        error:
          'POSTIZ_API_TOKEN is not configured.',
      });
      return;
    }

    const {
      startDate,
      endDate,
      mappings,
    } = req.body || {};

    if (
      typeof startDate !== 'string' ||
      typeof endDate !== 'string' ||
      !Array.isArray(mappings)
    ) {
      res.status(400).json({
        error:
          'startDate, endDate and mappings[] are required.',
      });
      return;
    }

    try {
      const client = new PostizClient(
        config.postizApiToken,
        config.postizBaseUrl,
      );

      const result =
        await syncPostizMappings(
          client,
          queue,
          {
            startDate,
            endDate,
            mappings:
              mappings as PostizTargetMapping[],
          },
        );

      res.json(result);
    } catch (error) {
      res.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  },
);

app.listen(
  config.port,
  () => {
    console.log(
      `fb-worker API listening on http://localhost:${config.port}`,
    );
  },
);
