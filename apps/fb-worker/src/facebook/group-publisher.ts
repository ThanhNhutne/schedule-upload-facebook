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
    page.getByRole('button', {
      name: /create post|tạo bài viết|write something|what's on your mind|bạn viết gì|viết gì đó/i,
    }),
    page
      .locator('[role="button"]')
      .filter({
        hasText: /write something|what's on your mind|bạn viết gì|viết gì đó/i,
      }),
    ...CREATE_POST_TEXT.map((text) =>
      page.getByText(text, { exact: true }),
    ),
  ];

  const trigger = await firstVisible(candidates);

  if (!trigger) {
    throw new FacebookUiError(
      'Could not find the Facebook Group create-post control.',
    );
  }

  await trigger.click();
}

async function findCreatePostDialog(
  page: Page,
  timeoutMs = 15_000,
): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const dialogs = page.getByRole('dialog');
    const count = await dialogs.count().catch(() => 0);

    for (let index = count - 1; index >= 0; index -= 1) {
      const dialog = dialogs.nth(index);

      if (!(await dialog.isVisible().catch(() => false))) {
        continue;
      }

      const composer = await firstVisible([
        dialog.locator(
          '[contenteditable="true"][role="textbox"][data-lexical-editor="true"]',
        ),
        dialog.locator(
          '[contenteditable="true"][role="textbox"]',
        ),
      ]);

      if (!composer) {
        continue;
      }

      const submitCandidates = POST_BUTTON_TEXT.map((label) =>
        dialog.getByRole('button', {
          name: label,
          exact: true,
        }),
      );

      const submit = await firstVisible(submitCandidates);

      if (submit) {
        return dialog;
      }
    }

    await page.waitForTimeout(250);
  }

  throw new FacebookUiError(
    'Create-post control was clicked, but a valid Facebook Create Post dialog was not found.',
  );
}

async function findComposer(
  dialog: Locator,
): Promise<Locator> {
  const composer = await firstVisible([
    dialog.locator(
      '[contenteditable="true"][role="textbox"][data-lexical-editor="true"]',
    ),
    dialog.locator(
      '[contenteditable="true"][role="textbox"]',
    ),
  ]);

  if (!composer) {
    throw new FacebookUiError(
      'Create Post dialog opened, but its post composer textbox was not found.',
    );
  }

  return composer;
}

async function attachMedia(
  page: Page,
  dialog: Locator,
  mediaPaths: string[],
): Promise<void> {
  if (!mediaPaths.length) {
    return;
  }

  let input = dialog.locator(
    'input[type="file"]',
  ).last();

  if (
    (await input.count().catch(() => 0)) === 0
  ) {
    const mediaButton = await firstVisible([
      dialog.getByRole('button', {
        name: /photo|video|ảnh/i,
      }),
      dialog.getByText(
        /photo\/video|ảnh\/video/i,
      ),
    ]);

    if (mediaButton) {
      await mediaButton.click();
      await page.waitForTimeout(300);
    }

    input = dialog.locator(
      'input[type="file"]',
    ).last();
  }

  if (
    (await input.count().catch(() => 0)) === 0
  ) {
    throw new FacebookUiError(
      'Could not find a media file input inside the Facebook Create Post dialog.',
    );
  }

  await input.setInputFiles(
    mediaPaths,
  );
}

async function submitPost(
  dialog: Locator,
): Promise<void> {
  const candidates = POST_BUTTON_TEXT.map(
    (label) =>
      dialog.getByRole('button', {
        name: label,
        exact: true,
      }),
  );

  const button =
    await firstVisible(candidates);

  if (!button) {
    throw new FacebookUiError(
      'Could not find the Post/Đăng button inside the Facebook Create Post dialog.',
    );
  }

  await waitForEnabledButton(button);
  await button.click();
}

export async function publishFacebookGroupPost(
  context: BrowserContext,
  input: FacebookGroupJob,
): Promise<PublishResult> {
  const page =
    context.pages()[0] ??
    (await context.newPage());

  const materialized =
    await materializeMedia(
      input.media || [],
    );

  try {
    await page.goto(
      input.targetUrl,
      {
        waitUntil:
          'domcontentloaded',
        timeout: 60_000,
      },
    );

    if (
      isRealFacebookUrl(
        input.targetUrl,
      )
    ) {
      await assertFacebookLoggedIn(
        page,
      );
    }

    await openComposer(page);

    const dialog =
      await findCreatePostDialog(
        page,
      );

    const composer =
      await findComposer(dialog);

    await composer.click();
    await composer.fill(
      input.content,
    );

    await attachMedia(
      page,
      dialog,
      materialized.paths,
    );

    await submitPost(dialog);

    await dialog
      .waitFor({
        state: 'hidden',
        timeout: 30_000,
      })
      .catch(() => undefined);

    await page.waitForTimeout(750);

    return {
      status: 'POSTED',
      targetUrl: input.targetUrl,
      postUrl: page.url(),
      publishedAt:
        new Date().toISOString(),
    };
  } finally {
    await materialized.cleanup();
  }
}

export const publishFacebookGroupTextPost =
  publishFacebookGroupPost;

export async function saveFailureScreenshot(
  page: Page | undefined,
  directory: string,
  jobId: string,
): Promise<
  string | undefined
> {
  if (!page) {
    return undefined;
  }

  await mkdir(directory, {
    recursive: true,
  });

  const file = path.join(
    directory,
    `job-${jobId}-failed.png`,
  );

  const saved = await page
    .screenshot({
      path: file,
      fullPage: true,
    })
    .then(() => true)
    .catch(() => false);

  return saved
    ? file
    : undefined;
}
