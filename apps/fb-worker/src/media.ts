import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from './config.js';
import { PermanentAutomationError } from './errors.js';
import type { MediaAsset, MediaKind } from './types.js';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm']);

function inferKind(source: string): MediaKind | undefined {
  let pathname = source;
  try {
    pathname = new URL(source).pathname;
  } catch {}

  const ext = path.extname(pathname).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  return undefined;
}

function validateKind(asset: MediaAsset): void {
  const inferred = inferKind(asset.source);
  const kind = asset.kind || inferred;

  if (!kind) {
    throw new PermanentAutomationError(
      `Unsupported media extension: ${asset.source}`,
    );
  }

  if (asset.kind && inferred && asset.kind !== inferred) {
    throw new PermanentAutomationError(
      `Media kind does not match file extension: ${asset.source}`,
    );
  }
}

export type MaterializedMedia = {
  paths: string[];
  cleanup: () => Promise<void>;
};

export async function materializeMedia(
  assets: MediaAsset[] = [],
): Promise<MaterializedMedia> {
  if (!assets.length) {
    return { paths: [], cleanup: async () => undefined };
  }

  for (const asset of assets) validateKind(asset);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'fb-media-'));
  const paths: string[] = [];

  try {
    for (let index = 0; index < assets.length; index += 1) {
      const asset = assets[index];

      if (/^https?:\/\//i.test(asset.source)) {
        const response = await fetch(asset.source, {
          signal: AbortSignal.timeout(60_000),
        });

        if (!response.ok) {
          throw new Error(
            `Media download failed: HTTP ${response.status} ${asset.source}`,
          );
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > config.mediaDownloadMaxBytes) {
          throw new PermanentAutomationError(
            `Media exceeds configured size limit: ${asset.source}`,
          );
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > config.mediaDownloadMaxBytes) {
          throw new PermanentAutomationError(
            `Media exceeds configured size limit: ${asset.source}`,
          );
        }

        const sourcePath = new URL(asset.source).pathname;
        const ext =
          path.extname(sourcePath) || (asset.kind === 'video' ? '.mp4' : '.jpg');
        const target = path.join(tempDir, `media-${index}${ext}`);
        await writeFile(target, buffer);
        paths.push(target);
      } else {
        const localPath = path.resolve(asset.source);
        await access(localPath).catch(() => {
          throw new PermanentAutomationError(
            `Local media file not found: ${localPath}`,
          );
        });
        paths.push(localPath);
      }
    }

    return {
      paths,
      cleanup: async () => {
        await rm(tempDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}
