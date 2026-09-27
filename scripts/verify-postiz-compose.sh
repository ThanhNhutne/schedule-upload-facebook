#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "$ROOT_DIR/scripts/bootstrap-postiz.sh"

docker compose   -f "$ROOT_DIR/postiz-local/docker-compose.yaml"   config -q

echo "POSTIZ_COMPOSE_OK"
