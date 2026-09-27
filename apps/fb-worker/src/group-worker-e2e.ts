import express from 'express';
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { startFacebookWorker } from './worker.js';

async function main(): Promise<void> {
  const app = express();

  app.get('/groups/test', (_req, res) => {
    res.type('html').send(`
<!doctype html>
<html>
  <body>
    <button role="button" id="open-composer">Write something...</button>
    <div role="dialog" id="dialog" hidden>
      <div contenteditable="true" role="textbox" id="composer"></div>
      <button role="button" id="post-button">Post</button>
    </div>
    <script>
      const dialog = document.getElementById('dialog');

      document.getElementById('open-composer').addEventListener('click', () => {
        dialog.hidden = false;
      });

      document.getElementById('post-button').addEventListener('click', () => {
        dialog.hidden = true;
        history.pushState({}, '', '/groups/test/posts/queue-123');
      });
    </script>
  </body>
</html>
    `);
  });

  app.listen(3901, '127.0.0.1');

  const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue('facebook-publish', { connection });
  const queueEvents = new QueueEvents('facebook-publish', {
    connection: connection.duplicate(),
  });

  await queueEvents.waitUntilReady();

  // CI's API smoke test intentionally leaves one waiting job behind.
  await queue.drain(true);

  const worker = startFacebookWorker();
  await worker.waitUntilReady();

  const job = await queue.add('publish', {
    targetType: 'facebook_group',
    targetUrl: 'http://127.0.0.1:3901/groups/test',
    content: 'Queue worker end-to-end POC',
  });

  const result = await job.waitUntilFinished(queueEvents, 30_000);

  if (result?.status !== 'POSTED') {
    throw new Error(`Unexpected worker result: ${JSON.stringify(result)}`);
  }

  if (!String(result.postUrl).endsWith('/groups/test/posts/queue-123')) {
    throw new Error(`Unexpected post URL: ${result.postUrl}`);
  }

  console.log('GROUP_WORKER_E2E_OK');
  console.log(JSON.stringify(result));

  // Test-only process: GitHub runner disposes all child resources.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
