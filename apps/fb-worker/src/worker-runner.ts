import { startFacebookWorker } from './worker.js';

const worker = startFacebookWorker();

async function shutdown(signal: string): Promise<void> {
  console.log(`received ${signal}, closing worker`);
  await worker.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
