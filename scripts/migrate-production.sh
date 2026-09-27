#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example to .env and set production secrets."
  exit 1
fi

if ! grep -q '^AUTOMATION_API_TOKEN=.' .env; then
  echo "AUTOMATION_API_TOKEN must be set for production."
  exit 1
fi

docker compose -f docker-compose.prod.yml config -q
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

echo
echo "Production containers:"
docker compose -f docker-compose.prod.yml ps

echo
echo "Health:"
curl -fsS http://127.0.0.1:3001/health
echo
