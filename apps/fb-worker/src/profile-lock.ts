import path from 'node:path';
import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { BrowserProfileInUseError } from './errors.js';

export type BrowserProfileOwner =
  | 'browser-login'
  | 'worker'
  | 'browser-smoke';

interface BrowserProfileLockRecord {
  pid: number;
  owner: BrowserProfileOwner;
  acquiredAt: string;
  profileDir: string;
  runtimeId?: string;
}

export interface BrowserProfileLockStatus {
  lockPath: string;
  state: 'free' | 'held' | 'stale' | 'invalid';
  record?: BrowserProfileLockRecord;
}

export interface BrowserProfileLease {
  lockPath: string;
  owner: BrowserProfileOwner;
  release(): Promise<void>;
}

function getRuntimeId(): string | undefined {
  const replicaId = process.env.RAILWAY_REPLICA_ID?.trim();
  const deploymentId = process.env.RAILWAY_DEPLOYMENT_ID?.trim();

  if (replicaId) {
    return `railway-replica:${replicaId}`;
  }

  if (deploymentId) {
    return `railway-deployment:${deploymentId}`;
  }

  return undefined;
}

function getLockPath(profileDir: string): string {
  const absoluteProfileDir = path.resolve(profileDir);

  return path.join(
    path.dirname(absoluteProfileDir),
    `${path.basename(absoluteProfileDir)}.automation.lock`,
  );
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code =
      error &&
      typeof error === 'object' &&
      'code' in error
        ? String(error.code)
        : '';

    return code === 'EPERM';
  }
}

function isRecordOwnerAlive(
  record: BrowserProfileLockRecord,
): boolean {
  const currentRuntimeId = getRuntimeId();

  // A persisted lock from a previous Railway replica/deployment cannot
  // represent a live process in this runtime, even if Linux reused its PID.
  if (
    currentRuntimeId &&
    record.runtimeId !== currentRuntimeId
  ) {
    return false;
  }

  return isProcessAlive(record.pid);
}

async function readLockRecord(
  lockPath: string,
): Promise<BrowserProfileLockRecord | undefined> {
  try {
    const raw = await readFile(lockPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<BrowserProfileLockRecord>;

    if (
      typeof parsed.pid !== 'number' ||
      typeof parsed.owner !== 'string' ||
      typeof parsed.acquiredAt !== 'string' ||
      typeof parsed.profileDir !== 'string'
    ) {
      return undefined;
    }

    return parsed as BrowserProfileLockRecord;
  } catch (error) {
    const code =
      error &&
      typeof error === 'object' &&
      'code' in error
        ? String(error.code)
        : '';

    if (code === 'ENOENT') {
      return undefined;
    }

    return undefined;
  }
}

export async function inspectBrowserProfileLock(
  profileDir: string,
): Promise<BrowserProfileLockStatus> {
  const lockPath = getLockPath(profileDir);
  const record = await readLockRecord(lockPath);

  if (!record) {
    try {
      await readFile(lockPath, 'utf8');

      return {
        lockPath,
        state: 'invalid',
      };
    } catch {
      return {
        lockPath,
        state: 'free',
      };
    }
  }

  return {
    lockPath,
    state: isRecordOwnerAlive(record)
      ? 'held'
      : 'stale',
    record,
  };
}

async function removeStaleLock(
  lockPath: string,
  record: BrowserProfileLockRecord | undefined,
): Promise<boolean> {
  if (!record || isRecordOwnerAlive(record)) {
    return false;
  }

  await unlink(lockPath).catch(() => undefined);
  return true;
}

export async function acquireBrowserProfileLease(
  profileDir: string,
  owner: BrowserProfileOwner,
): Promise<BrowserProfileLease> {
  const absoluteProfileDir = path.resolve(profileDir);
  const lockPath = getLockPath(absoluteProfileDir);

  await mkdir(path.dirname(lockPath), {
    recursive: true,
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const record: BrowserProfileLockRecord = {
      pid: process.pid,
      owner,
      acquiredAt: new Date().toISOString(),
      profileDir: absoluteProfileDir,
      runtimeId: getRuntimeId(),
    };

    try {
      await writeFile(
        lockPath,
        JSON.stringify(record, null, 2),
        {
          encoding: 'utf8',
          flag: 'wx',
        },
      );

      let released = false;

      return {
        lockPath,
        owner,
        async release() {
          if (released) {
            return;
          }

          released = true;

          const current = await readLockRecord(lockPath);

          if (
            current?.pid === process.pid &&
            current.owner === owner &&
            current.runtimeId === record.runtimeId
          ) {
            await unlink(lockPath).catch(() => undefined);
          }
        },
      };
    } catch (error) {
      const code =
        error &&
        typeof error === 'object' &&
        'code' in error
          ? String(error.code)
          : '';

      if (code !== 'EEXIST') {
        throw error;
      }

      const existing = await readLockRecord(lockPath);

      if (
        attempt === 0 &&
        (await removeStaleLock(lockPath, existing))
      ) {
        continue;
      }

      const holder = existing
        ? `${existing.owner} (PID ${existing.pid}, since ${existing.acquiredAt})`
        : 'an unknown process';

      throw new BrowserProfileInUseError(
        `Facebook browser profile is already reserved by ${holder}. Profile: ${absoluteProfileDir}. Stop the other browser-login/worker process before continuing.`,
      );
    }
  }

  throw new BrowserProfileInUseError(
    `Could not acquire Facebook browser profile lock for ${absoluteProfileDir}.`,
  );
}
