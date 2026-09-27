import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PostizClient } from '../apps/fb-worker/src/postiz/client.js';

const baseUrl = process.env.POSTIZ_BASE_URL || 'http://localhost:4007';
const apiKey = process.env.POSTIZ_API_TOKEN || '';

const ui = await fetch(baseUrl, {
  signal: AbortSignal.timeout(15_000),
});

console.log(`POSTIZ_UI_HTTP=${ui.status}`);

if (!apiKey) {
  console.log('POSTIZ_API_TOKEN is empty; UI reachability only.');
  process.exit(ui.ok || ui.status < 500 ? 0 : 1);
}

const client = new PostizClient(apiKey, baseUrl);
const connected = await client.isConnected();

console.log(`POSTIZ_API_CONNECTED=${connected.connected}`);

const integrations = await client.integrations();
console.log(`POSTIZ_INTEGRATIONS=${integrations.length}`);

const now = Date.now();
const posts = await client.listPosts(
  new Date(now - 86_400_000).toISOString(),
  new Date(now + 86_400_000).toISOString(),
);

console.log(`POSTIZ_POSTS_48H=${posts.posts.length}`);

const smokeIntegrationId = process.env.POSTIZ_SMOKE_INTEGRATION_ID;

if (
  process.env.POSTIZ_SMOKE_CREATE_DRAFT === 'true' &&
  smokeIntegrationId
) {
  const draft = await client.createPost({
    type: 'draft',
    shortLink: false,
    date: new Date(now + 3_600_000).toISOString(),
    tags: [],
    creationMethod: 'API',
    posts: [
      {
        integration: { id: smokeIntegrationId },
        value: [
          {
            content:
              `schedule-upload-facebook smoke ${new Date().toISOString()}`,
            image: [],
          },
        ],
      },
    ],
  });

  console.log('POSTIZ_DRAFT_CREATED');
  console.log(JSON.stringify(draft));
}

const uploadFile = process.env.POSTIZ_SMOKE_UPLOAD_FILE;

if (uploadFile) {
  const file = await readFile(path.resolve(uploadFile));
  const form = new FormData();

  form.append(
    'file',
    new Blob([new Uint8Array(file)]),
    path.basename(uploadFile),
  );

  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/public/v1/upload`,
    {
      method: 'POST',
      headers: { Authorization: apiKey },
      body: form,
      signal: AbortSignal.timeout(60_000),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Postiz upload smoke failed: HTTP ${response.status}`,
    );
  }

  console.log('POSTIZ_UPLOAD_OK');
  console.log(await response.text());
}
