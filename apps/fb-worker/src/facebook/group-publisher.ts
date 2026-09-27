import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Locator, Page } from 'playwright';
import { FacebookUiError, ManualActionRequiredError } from '../errors.js';
import type { FacebookGroupJob, PublishResult } from '../types.js';

const CREATE_POST_TEXT = [
  'Write something...',
  'Write something…',
  "What's on your mind?",
  'Bạn viết gì đi...',
  'Bạn viết gì đi…',
  'Viết gì đó...',
  'Viết gì đó…',
];

const POST_BUTTON_TEXT = ['Post', 'Đăng'];

function isRealFacebookUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'facebook.com' || host === 'www.facebook.com' || host.endsWith('.facebook.com');
  } catch {
    return false;
  }
}

async function firstVisible(locators: Locator[]): Promise<Locator | null> {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const candidate = locator.nth(i);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
  }
  return null;
}

async function assertLoggedIn(page: Page): Promise<void> {
  const loginSelectors = [
    page.locator('input[name="email"]'),
    page.locator('input[name="pass"]'),
    page.getByRole('button', { name: /log in|đăng nhập/i }),
  ];

  const loginControl = await firstVisible(loginSelectors);
  if (loginControl) {
    throw new ManualActionRequiredError(
      'Facebook session is not logged in. Run npm run browser:login and complete login manually.',
    );
  }
}

async function openComposer(page: Page): Promise<void> {
  const candidates: Locator[] = [
    page.locator('[role="button"]').filter({ hasText: /write something|what's on your mind|bạn viết gì|viết gì đó/i }),
    ...CREATE_POST_TEXT.map((text) => page.getByText(text, { exact: true })),
  ];

  const trigger = await firstVisible(candidates);
  if (!trigger) {
    throw new FacebookUiError('Could not find the Facebook Group create-post control.');
  }

  await trigger.click();
}

async function findComposer(page: Page): Promise<Locator> {
  const dialog = page.getByRole('dialog').last();
  if (await dialog.isVisible().catch(() => false)) {
    const inDialog = await firstVisible([
      dialog.locator('[contenteditable="true"][role="textbox"]'),
      dialog.locator('[contenteditable="true"]'),
    ]);

    if (inDialog) return inDialog;
  }

  const fallback = await firstVisible([
    page.locator('[contenteditable="true"][role="textbox"]'),
    page.locator('[contenteditable="true"]'),
  ]);

  if (!fallback) {
    throw new FacebookUiError('Create-post dialog opened, but no editable composer was found.');
  }

  return fallback;
}

async function submitPost(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog').last();

  const candidates: Locator[] = [];
  for (const label of POST_BUTTON_TEXT) {
    candidates.push(dialog.getByRole('button', { name: label, exact: true }));
    candidates.push(page.getByRole('button', { name: label, exact: true }));
  }

  const button = await firstVisible(candidates);
  if (!button) {
    throw new FacebookUiError('Could not find the Post/Đăng button.');
  }

  await button.waitFor({ state: 'visible', timeout: 15_000 });
  await button.click();
}

async function waitForPublishCompletion(page: Page): Promise<void> {
  await page
    .getByRole('dialog')
    .last()
    .waitFor({ state: 'hidden', timeout: 30_000 })
    .catch(() => undefined);

  await page.waitForTimeout(1_000);
}

export async function publishFacebookGroupTextPost(
  context: BrowserContext,
  input: FacebookGroupJob,
): Promise<PublishResult> {
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(input.targetUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  if (isRealFacebookUrl(input.targetUrl)) {
    await assertLoggedIn(page);
  }

  await openComposer(page);
  const composer = await findComposer(page);

  await composer.click();
  await composer.fill(input.content);

  await submitPost(page);
  await waitForPublishCompletion(page);

  return {
    status: 'POSTED',
    targetUrl: input.targetUrl,
    postUrl: page.url(),
    publishedAt: new Date().toISOString(),
  };
}

export async function saveFailureScreenshot(
  page: Page | undefined,
  directory: string,
  jobId: string,
): Promise<string | undefined> {
  if (!page) return undefined;

  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `job-${jobId}-failed.png`);

  await page.screenshot({ path: file, fullPage: true }).catch(() => undefined);
  return file;
}
