import express from 'express';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { PostizClient } from './postiz/client.js';
import { syncPostizMappings } from './postiz/adapter.js';
import { startFacebookWorker } from './worker.js';

async function main(): Promise<void> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'full-e2e-'));
  const mediaPath = path.join(tempDir, 'sample.jpg');

  await writeFile(
    mediaPath,
    Buffer.from('fake-image-for-browser-file-input'),
  );

  const app = express();

  app.get('/groups/test', (_req, res) => {
    res.type('html').send(`
<!doctype html>
<html>
<body>
  <button role="button" id="open">Write something...</button>
  <div role="dialog" id="dialog" hidden>
    <div contenteditable="true" role="textbox" id="composer"></div>
    <input type="file" multiple id="media">
    <button role="button" id="post">Post</button>
  </div>
  <div id="result"></div>
  <script>
    const dialog = document.getElementById('dialog');
    document.getElementById('open').onclick = () => {
      dialog.hidden = false;
    };
    document.getElementById('post').onclick = () => {
      const count = document.getElementById('media').files.length;
      document.getElementById('result').textContent =
        document.getElementById('composer').textContent + '|files=' + count;
      dialog.hidden = true;
      history.pushState({}, '', '/groups/test/posts/full-123');
    };
  </script>
</body>
</html>
    `);
  });

  app.get('/marketplace/create/item', (_req, res) => {
    res.type('html').send(`
<!doctype html>
<html>
<body>
  <input type="file" multiple aria-label="Photos">
  <label>Title<input aria-label="Title"></label>
  <label>Price<input aria-label="Price"></label>
  <label>Category<select aria-label="Category"><option>Property Rentals</option></select></label>
  <label>Condition<select aria-label="Condition"><option>New</option></select></label>
  <label>Location<input aria-label="Location"></label>
  <label>Description<textarea aria-label="Description"></textarea></label>
  <button role="button" id="publish">Publish</button>
  <script>
    document.getElementById('publish').onclick = () => {
      history.pushState({}, '', '/marketplace/item/full-456');
    };
  </script>
</body>
</html>
    `);
  });

  app.get('/public/v1/posts', (req, res) => {
    if (req.header('authorization') !== 'test-key') {
      res.status(401).json({ error: 'bad auth' });
      return;
    }

    res.json({
      posts: [
        {
          id: 'postiz-1',
          content: 'Postiz mapped content',
          publishDate: new Date(Date.now() + 60_000).toISOString(),
          state: 'QUEUE',
          integration: {
            id: 'integration-1',
            providerIdentifier: 'facebook',
          },
        },
      ],
    });
  });

  app.get('/public/v1/is-connected', (_req, res) => {
    res.json({ connected: true });
  });

  app.get('/public/v1/integrations', (_req, res) => {
    res.json([{ id: 'integration-1', name: 'Mock' }]);
  });

  const server = app.listen(3905, '127.0.0.1');

  const connection = new Redis(
    process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    { maxRetriesPerRequest: null },
  );

  const queue = new Queue('facebook-publish', { connection });
  const events = new QueueEvents('facebook-publish', {
    connection: connection.duplicate(),
  });
  const adapterQueue = new Queue('postiz-adapter-smoke', {
    connection: connection.duplicate(),
  });

  await events.waitUntilReady();
  await queue.drain(true);
  await adapterQueue.drain(true);

  const postiz = new PostizClient(
    'test-key',
    'http://127.0.0.1:3905',
  );

  const connected = await postiz.isConnected();
  if (!connected.connected) {
    throw new Error('Postiz connectivity mock failed.');
  }

  const sync = await syncPostizMappings(postiz, adapterQueue, {
    startDate: new Date(Date.now() - 60_000).toISOString(),
    endDate: new Date(Date.now() + 3_600_000).toISOString(),
    mappings: [
      {
        postId: 'postiz-1',
        targetType: 'facebook_group',
        targetUrl: 'http://127.0.0.1:3905/groups/test',
        media: [{ source: mediaPath, kind: 'image' }],
      },
    ],
  });

  if (sync.created.length !== 1) {
    throw new Error(`Postiz adapter failed: ${JSON.stringify(sync)}`);
  }

  await adapterQueue.drain(true);
  await adapterQueue.close();

  const worker = startFacebookWorker();
  await worker.waitUntilReady();

  const groupJob = await queue.add('publish', {
    targetType: 'facebook_group',
    targetUrl: 'http://127.0.0.1:3905/groups/test',
    content: 'Group with media',
    media: [{ source: mediaPath, kind: 'image' }],
  });

  const groupResult = await groupJob.waitUntilFinished(events, 30_000);

  if (
    groupResult?.status !== 'POSTED' ||
    !String(groupResult.postUrl).endsWith('/groups/test/posts/full-123')
  ) {
    throw new Error(
      `Group media publish failed: ${JSON.stringify(groupResult)}`,
    );
  }

  const marketplaceJob = await queue.add('publish', {
    targetType: 'facebook_marketplace',
    createUrl: 'http://127.0.0.1:3905/marketplace/create/item',
    listing: {
      title: 'Mock apartment',
      price: 5500000,
      category: 'Property Rentals',
      condition: 'New',
      location: 'District 7',
      description: 'Marketplace mock description',
      media: [{ source: mediaPath, kind: 'image' }],
    },
  });

  const marketplaceResult =
    await marketplaceJob.waitUntilFinished(events, 30_000);

  if (
    marketplaceResult?.status !== 'POSTED' ||
    !String(marketplaceResult.postUrl).endsWith(
      '/marketplace/item/full-456',
    )
  ) {
    throw new Error(
      `Marketplace publish failed: ${JSON.stringify(marketplaceResult)}`,
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 250));

  const logFile = path.join(
    process.env.LOG_DIR || './logs',
    'jobs.jsonl',
  );

  const logText = await readFile(logFile, 'utf8');
  if (!logText.includes('"event":"POSTED"')) {
    throw new Error('Job JSONL logging did not record POSTED.');
  }

  console.log('FULL_E2E_OK');
  console.log(
    JSON.stringify({
      postizAdapter: sync,
      group: groupResult,
      marketplace: marketplaceResult,
    }),
  );

  await rm(tempDir, { recursive: true, force: true });
  server.closeAllConnections?.();
  server.close();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
