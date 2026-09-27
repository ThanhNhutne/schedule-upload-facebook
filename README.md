# schedule-upload-facebook

Local-first social publishing automation layer built around **Postiz + Playwright**.

## Architecture

```text
Postiz
  |
  | REST API / scheduled content
  v
Automation API
  |
  v
Redis / BullMQ
  |
  v
fb-worker
  |
  v
Playwright + persistent Chromium profile
  |
  +--> Facebook Groups
  +--> Facebook Marketplace
```

Postiz remains responsible for content, media, calendar, and platforms supported by official APIs. This repository owns only the custom automation layer.

## Current phase

Phase 1 scaffold:

- Local Postiz bootstrap helper
- Redis for automation jobs
- TypeScript worker
- Playwright persistent Chromium profile
- Manual Facebook login flow
- Health endpoint
- Safe foundation for Group and Marketplace automation

No CAPTCHA, 2FA, checkpoint, or anti-abuse bypass is implemented.

## Repository layout

```text
.
├── apps/
│   └── fb-worker/
├── docs/
├── scripts/
├── .env.example
├── docker-compose.local.yml
└── package.json
```

## Local quick start

### 1. Requirements

- Git
- Docker + Docker Compose
- Node.js 22+
- npm

### 2. Clone

```bash
git clone https://github.com/ThanhNhutne/schedule-upload-facebook.git
cd schedule-upload-facebook
```

### 3. Environment

```bash
cp .env.example .env
```

### 4. Start Redis

```bash
docker compose -f docker-compose.local.yml up -d
```

### 5. Install worker

```bash
npm install
npm run playwright:install
```

### 6. Start API/worker

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:3001/health
```

### 7. Open persistent Facebook browser session

```bash
npm run browser:login
```

Log in manually. The Chromium profile is kept in `./data/browser-profile` and is ignored by Git.

### 8. Bootstrap Postiz locally

```bash
bash scripts/bootstrap-postiz.sh
```

Then follow:

```text
docs/LOCAL_SETUP.md
```

## Development order

1. Postiz local
2. Persistent Facebook browser session
3. One Group text post proof-of-concept
4. Image/video upload
5. BullMQ job queue
6. Automation REST API
7. Postiz adapter
8. Marketplace proof-of-concept
9. Logs, screenshots, retry, manual-action state
10. Production hardening

## Security

Never commit:

- Facebook cookies
- Chromium profiles
- API tokens
- Postiz JWT secrets
- database passwords
- screenshots containing private data

See `.gitignore`.
