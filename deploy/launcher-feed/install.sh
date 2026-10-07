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

ASSET_DIR="$REPO_DIR/launcher-feed/assets"
ASSET_FILE="$ASSET_DIR/CML-Base-Resources-v1.zip"
ASSET_URL="https://github.com/HowlingWhispers/HW-Landing/releases/download/launcher-assets-v1/CML-Base-Resources-v1.zip"
ASSET_SHA256="031f3b05d3efaf9b40436fedfee64cecfd92cf8d259edc3b637a633905231838"

mkdir -p "$ASSET_DIR"

if [[ ! -f "$ASSET_FILE" ]] || ! echo "$ASSET_SHA256  $ASSET_FILE" | sha256sum --check --status; then
  echo "Fetching CML Base Resources from HW-Landing GitHub Releases..."
  tmp="$ASSET_FILE.part"
  rm -f "$tmp"
  curl --fail --location --retry 3 "$ASSET_URL" --output "$tmp"
  echo "$ASSET_SHA256  $tmp" | sha256sum --check -
  mv "$tmp" "$ASSET_FILE"
else
  echo "CML Base Resources already present and verified."
fi

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
