#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-/srv/howling-whispers/landing}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$REPO_DIR/server/launcher-feed.mjs" ]]; then
  echo "HW-Landing was not found at: $REPO_DIR" >&2
  echo "Usage: sudo ./install.sh /srv/howling-whispers/landing" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. HW-Landing production currently expects Node 24 LTS." >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 20 )); then
  echo "Node.js 20+ is required; Node 24 LTS is recommended." >&2
  exit 1
fi

if [[ ! -f /etc/hw-launcher-feed.env ]]; then
  install -m 0644 "$HERE/hw-launcher-feed.env.example" /etc/hw-launcher-feed.env
  sed -i "s#^LAUNCHER_FEED_DATA=.*#LAUNCHER_FEED_DATA=$REPO_DIR/launcher-feed/data#" /etc/hw-launcher-feed.env
  echo "Created /etc/hw-launcher-feed.env"
else
  echo "Keeping existing /etc/hw-launcher-feed.env"
fi

mkdir -p "$REPO_DIR/launcher-feed/assets"
install -m 0644 "$HERE/hw-launcher-feed.service" /etc/systemd/system/hw-launcher-feed.service
systemctl daemon-reload
systemctl enable --now hw-launcher-feed.service

echo
echo "CodaLauncher feed installed."
echo "Health: http://SERVER_IP:3220/api/health"
echo "News:   http://SERVER_IP:3220/api/news"
echo
echo "If a firewall is enabled, open TCP 3220 deliberately."
echo "Do not expose future login/account endpoints over plain HTTP."
