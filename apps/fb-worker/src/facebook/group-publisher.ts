import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserContext, Locator, Page } from 'playwright';
import { FacebookUiError } from '../errors.js';
import { materializeMedia } from '../media.js';
import type { FacebookGroupJob, PublishResult } from '../types.js';
import {
  assertFacebookLoggedIn,
  firstVisible,
  isRealFacebookUrl,
  waitForEnabledButton,
} from './ui.js';

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

async function openComposer(page: Page): Promise<void> {
  const candidates: Locator[] = [
    page
      .locator('[role="button"]')
      .filter({
        hasText: /write something|what's on your mind|bạn viết gì|viết gì đó/i,
      }),
    ...CREATE_POST_TEXT.map((text) => page.getByText(text, { exact: true })),
  ];

  const trigger = await firstVisible(candidates);
  if (!trigger) {
    throw new FacebookUiError(
      'Could not find the Facebook Group create-post control.',
    );
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
    throw new FacebookUiError(
      'Create-post dialog opened, but no editable composer was found.',
    );
  }

  return fallback;
}

async function attachMedia(page: Page, mediaPaths: string[]): Promise<void> {
  if (!mediaPaths.length) return;

  const dialog = page.getByRole('dialog').last();
  let input = dialog.locator('input[type="file"]').last();

  if ((await input.count().catch(() => 0)) === 0) {
    const mediaButton = await firstVisible([
      dialog.getByRole('button', { name: /photo|video|ảnh/i }),
      page.getByRole('button', { name: /photo|video|ảnh/i }),
      dialog.getByText(/photo\/video|ảnh\/video/i),
    ]);

    if (mediaButton) {
      await mediaButton.click();
      await page.waitForTimeout(300);
    }

    input = dialog.locator('input[type="file"]').last();
  }

  if ((await input.count().catch(() => 0)) === 0) {
    input = page.locator('input[type="file"]').last();
  }

  if ((await input.count().catch(() => 0)) === 0) {
    throw new FacebookUiError(
      'Could not find a media file input in Group composer.',
    );
  }

  await input.setInputFiles(mediaPaths);
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

  await waitForEnabledButton(button);
  await button.click();
}

export async function publishFacebookGroupPost(
  context: BrowserContext,
  input: FacebookGroupJob,
): Promise<PublishResult> {
  const page = context.pages()[0] ?? (await context.newPage());
  const materialized = await materializeMedia(input.media || []);

  try {
    await page.goto(input.targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    if (isRealFacebookUrl(input.targetUrl)) {
      await assertFacebookLoggedIn(page);
    }

    await openComposer(page);
    const composer = await findComposer(page);

    await composer.click();
    await composer.fill(input.content);

    await attachMedia(page, materialized.paths);
    await submitPost(page);

    await page
      .getByRole('dialog')
      .last()
      .waitFor({ state: 'hidden', timeout: 30_000 })
      .catch(() => undefined);

    await page.waitForTimeout(750);

    return {
      status: 'POSTED',
      targetUrl: input.targetUrl,
      postUrl: page.url(),
      publishedAt: new Date().toISOString(),
    };
  } finally {
    await materialized.cleanup();
  }
}

export const publishFacebookGroupTextPost = publishFacebookGroupPost;

export async function saveFailureScreenshot(
  page: Page | undefined,
  directory: string,
  jobId: string,
): Promise<string | undefined> {
  if (!page) return undefined;

  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `job-${jobId}-failed.png`);

  const saved = await page
    .screenshot({ path: file, fullPage: true })
    .then(() => true)
    .catch(() => false);

  return saved ? file : undefined;
}
