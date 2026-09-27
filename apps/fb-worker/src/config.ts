import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3001),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  browserProfileDir: process.env.BROWSER_PROFILE_DIR || './data/browser-profile',
  screenshotDir: process.env.SCREENSHOT_DIR || './screenshots',
  logDir: process.env.LOG_DIR || './logs',
  headless: String(process.env.HEADLESS || 'false').toLowerCase() === 'true',
  mediaDownloadMaxBytes:
    Number(process.env.MEDIA_DOWNLOAD_MAX_MB || 200) * 1024 * 1024,
  automationApiToken: process.env.AUTOMATION_API_TOKEN || '',
  postizBaseUrl: process.env.POSTIZ_BASE_URL || 'http://localhost:4007',
  postizApiToken: process.env.POSTIZ_API_TOKEN || '',
  marketplaceCreateUrl:
    process.env.FACEBOOK_MARKETPLACE_CREATE_URL ||
    'https://www.facebook.com/marketplace/create/item',
};
