import { openPersistentFacebookContext } from './browser.js';

const context = await openPersistentFacebookContext();
try {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('data:text/html,<title>smoke</title><h1>Playwright OK</h1>');
  const title = await page.title();
  const text = await page.locator('h1').textContent();

  if (title !== 'smoke' || text !== 'Playwright OK') {
    throw new Error(`Unexpected browser smoke result: title=${title}, text=${text}`);
  }

  console.log('BROWSER_SMOKE_OK');
} finally {
  await context.close();
}
