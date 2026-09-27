# Production migration

## Architecture

Production stays split into two independent systems:

1. **Postiz** — content, calendar and platforms supported by official APIs.
2. **schedule-upload-facebook** — Facebook Group/Marketplace browser automation.

Do not merge the Playwright worker into the Postiz source tree.

## Host baseline

Recommended:

- Ubuntu 24.04 LTS
- Docker Engine + Compose plugin
- 4+ vCPU
- 8+ GB RAM
- SSD storage

Allocate more memory when Postiz and this stack share one host.

## Configure

```bash
cp .env.example .env
```

Production values:

```env
HEADLESS=true
AUTOMATION_API_TOKEN=<long-random-secret>
POSTIZ_BASE_URL=https://postiz.example.com
POSTIZ_API_TOKEN=<postiz-public-api-key>
```

Generate an API token:

```bash
openssl rand -hex 48
```

## Facebook browser profile

The worker does not bypass login, 2FA, CAPTCHA or checkpoints.

Create/verify a persistent session in an interactive environment:

```bash
npm run browser:login
```

For a remote server, use a secured interactive browser/VNC workflow or securely provision the browser profile. Never commit the profile to Git.

## Deploy

```bash
bash scripts/migrate-production.sh
```

The API binds to loopback only:

```text
127.0.0.1:3001
```

Use an authenticated HTTPS reverse proxy if remote access is required.

## Persistent data

Docker volumes:

- redis-data
- browser-profile
- screenshots
- logs

Treat `browser-profile` as authentication material.

## Update

```bash
git pull
docker compose -f docker-compose.prod.yml config -q
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

curl http://127.0.0.1:3001/health
docker compose -f docker-compose.prod.yml logs --tail=100 worker
```

## Security boundary

If Facebook presents login, 2FA, CAPTCHA, checkpoint or another security challenge, stop automation and resolve it manually. Do not add bypass logic.
