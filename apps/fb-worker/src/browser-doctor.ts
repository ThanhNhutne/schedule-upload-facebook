import { access, readdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { config } from './config.js';
import { inspectBrowserProfileLock } from './profile-lock.js';

async function main(): Promise<void> {
  const executablePath = chromium.executablePath();
  let browserInstalled = true;

  try {
    await access(executablePath);
  } catch {
    browserInstalled = false;
  }

  const profileLock = await inspectBrowserProfileLock(config.browserProfileDir);

  let singletonFiles: string[] = [];
  try {
    singletonFiles = (await readdir(config.browserProfileDir))
      .filter((name) => name.startsWith('Singleton'));
  } catch {
    singletonFiles = [];
  }

  console.log(JSON.stringify({
    browserInstalled,
    executablePath,
    browserProfileDir: config.browserProfileDir,
    headless: config.headless,
    profileLock,
    chromiumSingletonFiles: singletonFiles,
  }, null, 2));

  if (!browserInstalled) {
    process.exitCode = 2;
    return;
  }

  if (profileLock.state === 'held') {
    process.exitCode = 3;
    return;
  }

  if (profileLock.state === 'invalid') {
    process.exitCode = 4;
    return;
  }

  console.log('BROWSER_DOCTOR_OK');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
