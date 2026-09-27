import { chromium, type BrowserContext } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { config } from './config.js';

export async function openPersistentFacebookContext(): Promise<BrowserContext> {
  await mkdir(config.browserProfileDir, { recursive: true });

  return chromium.launchPersistentContext(config.browserProfileDir, {
    headless: config.headless,
    viewport: { width: 1440, height: 1000 },
    args: ['--disable-dev-shm-usage'],
  });
}

export async function isFacebookLoggedIn(context: BrowserContext): Promise<boolean> {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });

  const loginField = page.locator('input[name="email"]');
  const loginVisible = await loginField.isVisible().catch(() => false);

  return !loginVisible;
}
