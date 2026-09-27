# schedule-upload-facebook

Local-first automation layer for **Postiz + Facebook Group + Facebook Marketplace**.

## Architecture

```text
Postiz
  |
  | Public API
  v
Automation API
  |
  v
Redis / BullMQ
  |
  v
Playwright worker
  |
  +--> Facebook Groups
  +--> Facebook Marketplace
```

Postiz remains responsible for content/calendar and platforms supported through official APIs. This repository owns the custom browser automation layer.

## Milestones

| Milestone | Implementation |
|---|---|
| L01 Repository scaffold | Done |
| L02 Postiz local bootstrap | Done |
| L03 Postiz verification tooling | Done |
| L04 Redis + Automation API | Done |
| L05 Persistent Chromium session | Done |
| L06 Group text POC | Done |
| L07 Group images/video | Done |
| L08 Queue + scheduling + job states | Done |
| L09 Postiz adapter | Done |
| L10 Marketplace POC | Done |
| L11 Retry/logging/screenshots | Done |
| L12 Dockerized API/worker | Done |
| L13 Production migration tooling | Done |

“Done” means the implementation exists and is covered by CI/mock tests where credentials are not required. Real Facebook/Postiz publishing requires the operator's own authenticated Facebook session and Postiz API token.

## Quick start

```bash
git clone https://github.com/ThanhNhutne/schedule-upload-facebook.git
cd schedule-upload-facebook

cp .env.example .env

npm install
npm run playwright:install

docker compose -f docker-compose.local.yml up -d redis

npm run browser:login
```

Run API:

```bash
npm run dev
```

Run worker:

```bash
npm run worker
```

Health:

```bash
curl http://localhost:3001/health
```

## Full smoke

With Redis on localhost:

```bash
HEADLESS=true \
BROWSER_PROFILE_DIR=/tmp/fb-full-profile \
LOG_DIR=/tmp/fb-full-logs \
SCREENSHOT_DIR=/tmp/fb-full-screens \
npm run smoke:full
```

## Security

No CAPTCHA, 2FA, checkpoint, account-security, or anti-abuse bypass is implemented.

Never commit:

- Facebook cookies/browser profiles
- Postiz API keys
- automation API tokens
- screenshots/logs containing private data

See:

- `docs/LOCAL_SETUP.md`
- `docs/PRODUCTION.md`
