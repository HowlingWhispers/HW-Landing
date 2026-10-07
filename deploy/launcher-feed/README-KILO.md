# Kilo deployment handoff: CodaLauncher feed

This folder is intentionally self-contained. The launcher feed is a tiny,
read-only Node service. It needs no database, Discord credentials, Minecraft
credentials, domain, or extra npm dependency.

Deployment assets are published under the `launcher-assets-v1` GitHub Release in
`HowlingWhispers/HW-Landing`. The installer downloads and SHA-256 verifies any
required asset automatically. Kilo should not need Discord/CDN or ChatGPT file
links for normal deployment.

## Install

From a fresh/pulled `HowlingWhispers/HW-Landing` main checkout:

```bash
cd /srv/howling-whispers/landing
npm ci
npm run test:launcher-feed
sudo ./deploy/launcher-feed/install.sh /srv/howling-whispers/landing
curl -fsS http://127.0.0.1:3220/api/health
```

For the direct-IP prototype the included environment binds to
`0.0.0.0:3220`. If the host firewall is enabled, open TCP 3220 only if this
public feed should be Internet-reachable.

Then verify from another machine:

```text
http://SERVER_IP:3220/
http://SERVER_IP:3220/api/news
http://SERVER_IP:3220/api/status
http://SERVER_IP:3220/api/feed
http://SERVER_IP:3220/assets/CML-Base-Resources-v1.zip
```

## Domain

No domain is required for this public, read-only phase. CodaLauncher can use
`http://SERVER_IP:3220`.

Before adding CML accounts, Discord OAuth, Minecraft ownership verification,
session tokens, or anything private, place the service behind HTTPS. The
optional Nginx snippet in this folder is for that later step.

## Updating the feed

Edit:

```text
launcher-feed/data/news.json
launcher-feed/data/status.json
```

and pull `main` on the server. The service reads these files on every request,
so news/status changes do not require a restart.

## Boundaries

- GET/HEAD/OPTIONS only.
- CORS `*` is intentional for a desktop launcher.
- This service contains public display data only.
- Do not put secrets or user data in the JSON files.
- The service hosts the mandatory CML Base Resources ZIP after fetching it from the HW-Landing GitHub Release. It contains the CML Base Pack's presentation assets: title/banner, panoramas, menu music, splashes and related defaults.
- CodaLauncher verifies the resource pack against the SHA-256 advertised by /api/feed and installs it automatically as a dependency of CML Base.
- The feed is not trusted to provide CodaLauncher or CodaLoader executable payloads.
- CodaLoader/CodaLauncher binaries continue to come from GitHub Releases with integrity checks.
