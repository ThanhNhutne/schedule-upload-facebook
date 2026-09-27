import type { BrowserContext, Locator, Page } from 'playwright';
import { config } from '../config.js';
import { FacebookUiError } from '../errors.js';
import { materializeMedia } from '../media.js';
import type { FacebookMarketplaceJob, PublishResult } from '../types.js';
import {
  assertFacebookLoggedIn,
  firstVisible,
  isRealFacebookUrl,
  waitForEnabledButton,
} from './ui.js';

async function fillField(
  page: Page,
  labels: RegExp,
  value: string,
  required = true,
): Promise<void> {
  const field = await firstVisible([
    page.getByLabel(labels),
    page.getByPlaceholder(labels),
  ]);

  if (!field) {
    if (!required) return;
    throw new FacebookUiError(
      `Could not find Marketplace field matching ${labels}`,
    );
  }

  await field.fill(value);
}

async function selectChoice(
  page: Page,
  labels: RegExp,
  value: string | undefined,
): Promise<void> {
  if (!value) return;

  const labelled = await firstVisible([page.getByLabel(labels)]);

  if (labelled) {
    const tag = await labelled
      .evaluate((element) => element.tagName.toLowerCase())
      .catch(() => '');

    if (tag === 'select') {
      await labelled.selectOption({ label: value }).catch(async () => {
        await labelled.selectOption(value);
      });
      return;
    }
  }

  const trigger = await firstVisible([
    page.getByRole('button', { name: labels }),
    page.getByRole('combobox', { name: labels }),
    page.getByText(labels),
  ]);

  if (!trigger) {
    throw new FacebookUiError(
      `Could not find Marketplace selector matching ${labels}`,
    );
  }

  await trigger.click();

  const option = await firstVisible([
    page.getByRole('option', { name: value, exact: true }),
    page.getByText(value, { exact: true }),
  ]);

  if (!option) {
    throw new FacebookUiError(
      `Could not select Marketplace value: ${value}`,
    );
  }

  await option.click();
}

async function attachMedia(page: Page, mediaPaths: string[]): Promise<void> {
  if (!mediaPaths.length) return;

  const input = page.locator('input[type="file"]').first();
  if ((await input.count().catch(() => 0)) === 0) {
    throw new FacebookUiError('Could not find Marketplace media input.');
  }

  await input.setInputFiles(mediaPaths);
}

export async function publishFacebookMarketplaceListing(
  context: BrowserContext,
  input: FacebookMarketplaceJob,
): Promise<PublishResult> {
  const page = context.pages()[0] ?? (await context.newPage());
  const createUrl = input.createUrl || config.marketplaceCreateUrl;
  const materialized = await materializeMedia(input.listing.media || []);

  try {
    await page.goto(createUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    if (isRealFacebookUrl(createUrl)) {
      await assertFacebookLoggedIn(page);
    }

    await attachMedia(page, materialized.paths);
    await fillField(page, /title|tiêu đề/i, input.listing.title);

    if (input.listing.price !== undefined) {
      await fillField(page, /price|giá/i, String(input.listing.price));
    }

    await selectChoice(page, /category|danh mục/i, input.listing.category);
    await selectChoice(page, /condition|tình trạng/i, input.listing.condition);

    if (input.listing.location) {
      await fillField(
        page,
        /location|vị trí/i,
        input.listing.location,
        false,
      );
    }

    await fillField(
      page,
      /description|mô tả/i,
      input.listing.description,
    );

    const publish = await firstVisible([
      page.getByRole('button', { name: /publish|list|đăng/i }),
      page.getByText(/publish|đăng/i, { exact: true }),
    ]);

    if (!publish) {
      throw new FacebookUiError(
        'Could not find Marketplace Publish/Đăng button.',
      );
    }

    await waitForEnabledButton(publish);
    await publish.click();
    await page.waitForTimeout(750);

    return {
      status: 'POSTED',
      targetUrl: createUrl,
      postUrl: page.url(),
      publishedAt: new Date().toISOString(),
    };
  } finally {
    await materialized.cleanup();
  }
}
