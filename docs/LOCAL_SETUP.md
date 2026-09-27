# Local Development Setup

## Target architecture

```text
localhost:4007  Postiz
localhost:3001  Automation API
localhost:6379  Redis (bound to loopback)
Chromium         Persistent Facebook session
```

## 1. Requirements

- Docker + Docker Compose
- Git
- Node.js 22+
- npm

Check:

```bash
docker --version
docker compose version
node --version
npm --version
git --version
```

## 2. Clone this repository

```bash
git clone https://github.com/ThanhNhutne/schedule-upload-facebook.git
cd schedule-upload-facebook
```

## 3. Environment

```bash
cp .env.example .env
```

## 4. Start automation Redis

```bash
docker compose -f docker-compose.local.yml up -d
docker compose -f docker-compose.local.yml ps
```

## 5. Install Node dependencies

```bash
npm install
npm run playwright:install
```

On Ubuntu, if Playwright reports missing system packages:

```bash
npx playwright install-deps chromium
```

## 6. Start automation API

```bash
npm run dev
```

Test:

```bash
curl http://localhost:3001/health
```

Expected shape:

```json
{
  "ok": true,
  "service": "fb-worker-api",
  "redis": "PONG"
}
```

## 7. Create persistent Facebook session

Run:

```bash
npm run browser:login
```

A Chromium window opens.

Log in manually to Facebook and complete any normal Facebook security prompts. Close Chromium afterward.

The session is stored under:

```text
./data/browser-profile
```

That directory is excluded from Git.

## 8. Bootstrap Postiz locally

```bash
bash scripts/bootstrap-postiz.sh
```

Then:

```bash
cd postiz-local
nano docker-compose.yaml
```

For local use keep:

```yaml
MAIN_URL: 'http://localhost:4007'
FRONTEND_URL: 'http://localhost:4007'
NEXT_PUBLIC_BACKEND_URL: 'http://localhost:4007/api'
```

Generate a JWT secret:

```bash
openssl rand -hex 64
```

Replace the sample `JWT_SECRET`, then:

```bash
docker compose pull
docker compose up -d
docker compose ps
```

Open:

```text
http://localhost:4007
```

## 9. Local milestone order

```text
L01 Repository scaffold
L02 Postiz local running
L03 Postiz media/draft/calendar verified
L04 Redis + automation API running
L05 Persistent Chromium session verified
L06 Facebook Group text POC
L07 Facebook Group images/video
L08 BullMQ worker + job states
L09 Postiz adapter
L10 Marketplace POC
L11 Retry/logging/screenshots
L12 Containerize worker
L13 Production migration
```

## Current implementation status

Implemented:

- repository scaffold
- Redis local compose
- API health endpoint
- BullMQ enqueue endpoint
- persistent Playwright browser launcher
- manual Facebook login helper
- Postiz bootstrap helper

Not implemented yet:

- Facebook Group selectors/publish logic
- actual BullMQ job consumer
- Postiz adapter
- Marketplace publishing
- retry classification
- screenshots/log persistence

The next implementation milestone should be **L05/L06** after local infrastructure is confirmed.
