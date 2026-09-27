# Local Development Setup

## Services

```text
localhost:4007  Postiz
localhost:3001  Automation API
localhost:6379  Redis
Chromium         Persistent Facebook session
```

## Recommended Windows local topology

For real Facebook acceptance testing on Windows, keep Chromium and the worker native on Windows so they use the same OS-compatible persistent profile.

```text
Redis             Docker
Postiz            Docker / separate local stack
Automation API    native Windows
Worker            native Windows
Playwright        native Windows
Facebook profile  ./data/browser-profile
```

Do not run `browser:login` and `worker` at the same time. Both intentionally use the same persistent Facebook profile and the application now enforces an exclusive profile lock.

## L01-L03 — Postiz

Bootstrap the official Postiz compose:

```bash
bash scripts/bootstrap-postiz.sh
cd postiz-local
```

Configure local URLs, then:

```bash
docker compose up -d
docker compose ps
```

Verify:

```bash
cd ..
npm run postiz:check
```

With API:

```bash
POSTIZ_API_TOKEN='<key>' npm run postiz:check
```

Optional real upload/draft smoke:

```bash
POSTIZ_API_TOKEN='<key>' \
POSTIZ_SMOKE_UPLOAD_FILE='./sample.jpg' \
POSTIZ_SMOKE_CREATE_DRAFT=true \
POSTIZ_SMOKE_INTEGRATION_ID='<integration-id>' \
npm run postiz:check
```

Draft/upload checks modify Postiz data, so they are opt-in.

## L04-L08 — API, browser session, worker, media and scheduling

Initial setup:

```bash
cp .env.example .env
docker compose -f docker-compose.local.yml up -d redis

npm install
npm run playwright:install
```

Before opening the Facebook profile, inspect the browser state:

```bash
npm run browser:doctor
```

Expected when the profile is free:

```text
BROWSER_DOCTOR_OK
```

Create or refresh the Facebook session:

```bash
npm run browser:login
```

The login command owns the profile exclusively. Complete the login in Chromium, return to the terminal, and press Enter. The command then closes Chromium and releases the profile lock. Do not start the worker until the login command has exited.

API:

```bash
npm run dev
```

Worker:

```bash
npm run worker
```

The worker owns the same profile while its persistent Chromium context is open. If another application process already owns the profile, the job is classified as manual action required and is discarded instead of being retried repeatedly.

Group job with media:

```bash
curl -X POST http://localhost:3001/api/v1/jobs \
  -H 'Content-Type: application/json' \
  -d '{
    "targetType":"facebook_group",
    "targetUrl":"https://www.facebook.com/groups/GROUP_ID",
    "content":"Local POC",
    "media":[
      {
        "source":"./sample.jpg",
        "kind":"image"
      }
    ]
  }'
```

Video uses the same media array with `kind: "video"`.

Scheduling:

```json
{
  "scheduledAt":"2026-10-01T14:00:00+07:00"
}
```

Inspect:

```bash
curl http://localhost:3001/api/v1/jobs/JOB_ID
```

Cancel:

```bash
curl -X DELETE http://localhost:3001/api/v1/jobs/JOB_ID
```

Retry:

```bash
curl -X POST http://localhost:3001/api/v1/jobs/JOB_ID/retry
```

## Browser profile lifecycle

Normal flow:

```text
npm run browser:doctor
        ↓
npm run browser:login
        ↓
manual Facebook login if needed
        ↓
return to terminal and press Enter
        ↓
Chromium closes + profile lock released
        ↓
npm run worker
        ↓
worker opens and owns persistent profile
        ↓
submit jobs
```

If `browser:doctor` reports a held lock, it also reports the owner and PID. Stop that process rather than deleting browser files. Stale application locks are cleaned automatically on the next profile acquisition.

The Facebook profile directory itself must not be deleted during troubleshooting because it contains the persistent authenticated session.

## L09 — Postiz adapter

Current Postiz public endpoints used:

- `GET /public/v1/posts`
- `GET /public/v1/integrations`
- `GET /public/v1/is-connected`

Sync request:

```json
{
  "startDate":"2026-09-27T00:00:00+07:00",
  "endDate":"2026-09-28T00:00:00+07:00",
  "mappings":[
    {
      "postId":"POSTIZ_POST_ID",
      "targetType":"facebook_group",
      "targetUrl":"https://www.facebook.com/groups/GROUP_ID"
    }
  ]
}
```

```bash
curl -X POST http://localhost:3001/api/v1/postiz/sync \
  -H 'Content-Type: application/json' \
  -d @sync.json
```

Postiz calendar output exposes content/date but not the full original media payload. Media for custom browser targets is therefore supplied explicitly in the mapping.

## L10 — Marketplace

```bash
curl -X POST http://localhost:3001/api/v1/jobs \
  -H 'Content-Type: application/json' \
  -d '{
    "targetType":"facebook_marketplace",
    "listing":{
      "title":"Căn hộ full nội thất Quận 7",
      "price":5500000,
      "category":"Property Rentals",
      "location":"Quận 7",
      "description":"Nội dung listing",
      "media":[
        {
          "source":"./sample.jpg",
          "kind":"image"
        }
      ]
    }
  }'
```

Marketplace UI changes frequently. Selector failures are treated as permanent for that job and produce a failure screenshot.

## L11 — Logs, screenshots and retry

```text
./logs/jobs.jsonl
./screenshots/job-<id>-failed.png
```

Transient failures use BullMQ retry/backoff. Browser-profile conflicts, UI failures, security challenges, and other manual-action failures are discarded rather than blindly retried.

## L12 — Docker

Docker remains useful for Redis and Postiz locally.

For the first real Facebook acceptance test on Windows, run the Automation API, worker, and Playwright natively on Windows. Do not assume a Chromium profile created on Windows can be reused safely inside the Linux Playwright container.

## L13 — Production

See `docs/PRODUCTION.md`.
