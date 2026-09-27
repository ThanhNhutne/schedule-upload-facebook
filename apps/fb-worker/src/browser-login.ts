import { openPersistentFacebookContext } from './browser.js';

const context = await openPersistentFacebookContext();
const page = context.pages()[0] ?? await context.newPage();

await page.goto('https://www.facebook.com/', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});

console.log('');
console.log('Chromium opened with a persistent profile.');
console.log('Log in to Facebook manually, complete any required 2FA/checkpoint, then close the browser window.');
console.log('No CAPTCHA/2FA/checkpoint bypass is performed.');
console.log('');

await new Promise<void>((resolve) => context.on('close', () => resolve()));
