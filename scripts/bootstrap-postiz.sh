#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="$ROOT_DIR/postiz-local"

if [ -d "$TARGET_DIR/.git" ]; then
  echo "Postiz compose repo already exists: $TARGET_DIR"
else
  git clone https://github.com/gitroomhq/postiz-docker-compose.git "$TARGET_DIR"
fi

cd "$TARGET_DIR"

if [ ! -f docker-compose.yaml.original ]; then
  cp docker-compose.yaml docker-compose.yaml.original
fi

echo
echo "Postiz compose is ready at:"
echo "  $TARGET_DIR"
echo
echo "Next:"
echo "  1. Edit docker-compose.yaml"
echo "  2. Keep local URLs on http://localhost:4007"
echo "  3. Replace JWT_SECRET"
echo "  4. Run: docker compose up -d"
echo
