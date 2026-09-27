# Local Development Setup

## Services

```text
localhost:4007  Postiz
localhost:3001  Automation API
localhost:6379  Redis
Chromium         Persistent Facebook session
```

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

## L04-L08 — API, worker, media and scheduling

```bash
cp .env.example .env
docker compose -f docker-compose.local.yml up -d redis

npm install
npm run playwright:install
npm run browser:login
```

API:

```bash
npm run dev
```

Worker:

```bash
npm run worker
```

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

Transient failures use BullMQ retry/backoff. UI/security/manual-action failures do not retry indefinitely.

## L12 — Docker

After creating a valid browser profile:

```bash
docker compose -f docker-compose.local.yml build
docker compose -f docker-compose.local.yml up -d
```

## L13 — Production

See `docs/PRODUCTION.md`.
