import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 3001),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  browserProfileDir: process.env.BROWSER_PROFILE_DIR || './data/browser-profile',
  headless: String(process.env.HEADLESS || 'false').toLowerCase() === 'true',
  postizBaseUrl: process.env.POSTIZ_BASE_URL || 'http://localhost:4007',
  postizApiToken: process.env.POSTIZ_API_TOKEN || '',
};
