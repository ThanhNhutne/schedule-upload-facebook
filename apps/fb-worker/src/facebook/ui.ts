import type { Locator, Page } from 'playwright';
import { FacebookUiError, ManualActionRequiredError } from '../errors.js';

export async function firstVisible(locators: Locator[]): Promise<Locator | null> {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }
  return null;
}

export function isRealFacebookUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === 'facebook.com' ||
      host === 'www.facebook.com' ||
      host.endsWith('.facebook.com')
    );
  } catch {
    return false;
  }
}

export async function assertFacebookLoggedIn(page: Page): Promise<void> {
  const loginControl = await firstVisible([
    page.locator('input[name="email"]'),
    page.locator('input[name="pass"]'),
    page.getByRole('button', { name: /log in|đăng nhập/i }),
  ]);

  if (loginControl) {
    throw new ManualActionRequiredError(
      'Facebook session is not logged in. Run npm run browser:login and complete login manually.',
    );
  }
}

export async function waitForEnabledButton(
  button: Locator,
  timeoutMs = 60_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const visible = await button.isVisible().catch(() => false);
    const enabled = await button.isEnabled().catch(() => false);
    if (visible && enabled) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new FacebookUiError(
    'Submit button did not become enabled before timeout.',
  );
}
