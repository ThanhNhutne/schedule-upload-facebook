import express from 'express';
import { chromium } from 'playwright';
import { publishFacebookGroupTextPost } from './facebook/group-publisher.js';

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

    <div id="published"></div>

    <script>
      const dialog = document.getElementById('dialog');
      const composer = document.getElementById('composer');
      const published = document.getElementById('published');

      document.getElementById('open-composer').addEventListener('click', () => {
        dialog.hidden = false;
      });

      document.getElementById('post-button').addEventListener('click', () => {
        published.textContent = composer.textContent;
        dialog.hidden = true;
        history.pushState({}, '', '/groups/test/posts/123');
      });
    </script>
  </body>
</html>
  `);
});

const server = app.listen(3900, '127.0.0.1');

const context = await chromium.launchPersistentContext('/tmp/group-mock-profile', {
  headless: true,
});

try {
  const result = await publishFacebookGroupTextPost(context, {
    targetType: 'facebook_group',
    targetUrl: 'http://127.0.0.1:3900/groups/test',
    content: 'CI Facebook Group POC',
  });

  const page = context.pages()[0];
  const published = await page.locator('#published').textContent();

  if (published !== 'CI Facebook Group POC') {
    throw new Error(`Unexpected published content: ${published}`);
  }

  if (!page.url().endsWith('/groups/test/posts/123')) {
    throw new Error(`Unexpected post URL: ${page.url()}`);
  }

  console.log('GROUP_PUBLISH_SMOKE_OK');
  console.log(JSON.stringify(result));
} finally {
  await context.close();
  server.close();
}
