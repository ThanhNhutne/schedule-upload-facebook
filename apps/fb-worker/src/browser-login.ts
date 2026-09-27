import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  closePersistentFacebookContext,
  openPersistentFacebookContext,
} from './browser.js';

async function main(): Promise<void> {
  const context = await openPersistentFacebookContext('browser-login');
  const rl = createInterface({ input, output });

  try {
    const page = context.pages()[0] ?? await context.newPage();

    await page.goto('https://www.facebook.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('');
    console.log('Chromium opened with the dedicated Facebook profile.');
    console.log('Complete the Facebook login manually if needed.');
    console.log('When the session is ready, return here and press Enter.');
    console.log('Do not start the worker while this command is still running.');
    console.log('');

    await rl.question('Press Enter to save the session and close Chromium...');
  } finally {
    rl.close();
    await closePersistentFacebookContext(context);
  }

  console.log('Facebook browser session saved. The profile lock has been released.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
