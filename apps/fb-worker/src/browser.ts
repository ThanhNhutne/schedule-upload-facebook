import { chromium, type BrowserContext } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { config } from './config.js';
import { acquireBrowserProfileLease, type BrowserProfileLease, type BrowserProfileOwner } from './profile-lock.js';
import { BrowserProfileInUseError } from './errors.js';

const leases = new WeakMap<BrowserContext, BrowserProfileLease>();

function looksLikeChromiumProfileConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /exitCode=21|ProcessSingleton|profile.*in use|user data directory.*in use/i.test(message);
}

export async function openPersistentFacebookContext(
  owner: BrowserProfileOwner = 'worker',
): Promise<BrowserContext> {
  await mkdir(config.browserProfileDir, { recursive: true });
  const lease = await acquireBrowserProfileLease(config.browserProfileDir, owner);

  try {
    const context = await chromium.launchPersistentContext(config.browserProfileDir, {
      headless: config.headless,
      viewport: { width: 1440, height: 1000 },
      args: ['--disable-dev-shm-usage'],
    });

    leases.set(context, lease);
    context.once('close', () => {
      void lease.release();
      leases.delete(context);
    });

    return context;
  } catch (error) {
    await lease.release();

    if (looksLikeChromiumProfileConflict(error)) {
      throw new BrowserProfileInUseError(
        `Chromium could not open the Facebook browser profile because it is already in use. Profile: ${config.browserProfileDir}. Stop any other browser-login/worker process first.`,
      );
    }

    throw error;
  }
}

export async function closePersistentFacebookContext(
  context: BrowserContext,
): Promise<void> {
  const lease = leases.get(context);

  try {
    await context.close();
  } finally {
    if (lease) {
      await lease.release();
      leases.delete(context);
    }
  }
}

export async function isFacebookLoggedIn(
  context: BrowserContext,
): Promise<boolean> {
  const page = context.pages()[0] ?? await context.newPage();
  await page.goto('https://www.facebook.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  const loginField = page.locator('input[name="email"]');
  const loginVisible = await loginField.isVisible().catch(() => false);

  return !loginVisible;
}
