#!/usr/bin/env bash
set -Eeuo pipefail

export DISPLAY="${DISPLAY:-:99}"

DATA_DIR="${CLOUD_DATA_DIR:-/app/data}"
PROFILE_DIR="${BROWSER_PROFILE_DIR:-$DATA_DIR/browser-profile}"
SCREEN_DIR="${SCREENSHOT_DIR:-$DATA_DIR/screenshots}"
LOG_DIR_VALUE="${LOG_DIR:-$DATA_DIR/logs}"
NOVNC_PORT="${PORT:-6080}"
VNC_PORT="${VNC_PORT:-5900}"
SESSION_MARKER="$DATA_DIR/.facebook-session-ready"

if [[ -z "${VNC_PASSWORD:-}" ]]; then
  echo "VNC_PASSWORD is required."
  exit 1
fi

mkdir -p "$DATA_DIR" "$PROFILE_DIR" "$SCREEN_DIR" "$LOG_DIR_VALUE" /run/cloud-vnc

rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 || true

cleanup() {
  set +e
  [[ -n "${WEBSOCKIFY_PID:-}" ]] && kill "$WEBSOCKIFY_PID" 2>/dev/null
  [[ -n "${X11VNC_PID:-}" ]] && kill "$X11VNC_PID" 2>/dev/null
  [[ -n "${FLUXBOX_PID:-}" ]] && kill "$FLUXBOX_PID" 2>/dev/null
  [[ -n "${XVFB_PID:-}" ]] && kill "$XVFB_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

Xvfb "$DISPLAY" -screen 0 1440x1000x24 -ac +extension RANDR &
XVFB_PID=$!

for _ in $(seq 1 50); do
  if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

fluxbox >/tmp/fluxbox.log 2>&1 &
FLUXBOX_PID=$!

x11vnc -storepasswd "$VNC_PASSWORD" /run/cloud-vnc/passwd >/dev/null

x11vnc \
  -display "$DISPLAY" \
  -forever \
  -shared \
  -rfbport "$VNC_PORT" \
  -rfbauth /run/cloud-vnc/passwd \
  -noxdamage \
  -o /tmp/x11vnc.log &
X11VNC_PID=$!

websockify \
  --web=/usr/share/novnc \
  "$NOVNC_PORT" \
  "127.0.0.1:$VNC_PORT" &
WEBSOCKIFY_PID=$!

echo "noVNC listening on port $NOVNC_PORT"

if [[ "${CLOUD_FORCE_LOGIN:-false}" == "true" ]]; then
  rm -f "$SESSION_MARKER"
fi

if [[ ! -f "$SESSION_MARKER" ]]; then
  echo "Facebook session is not initialized."
  echo "Open the noVNC URL, log into Facebook manually, then switch to the terminal window and press Enter."

  xterm \
    -T "Facebook Login Control" \
    -geometry 115x18+10+10 \
    -e bash -lc "cd /app; npm run browser:login; rc=\$?; if [ \$rc -eq 0 ]; then touch '$SESSION_MARKER'; echo 'Session saved. Starting worker...'; sleep 3; fi; exit \$rc"

  if [[ ! -f "$SESSION_MARKER" ]]; then
    echo "Facebook login was not completed successfully."
    exit 1
  fi
fi

echo "Starting Facebook worker with persistent profile: $PROFILE_DIR"
exec npm run worker
