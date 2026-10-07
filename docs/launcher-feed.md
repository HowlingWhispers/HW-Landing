# CodaLauncher public feed

The first server component for CodaLauncher is intentionally small. It provides
public news and project status for a future desktop launcher and also renders a
simple human-readable browser page.

## Endpoints

```text
GET /              browser status/news page
GET /api/health    service health
GET /api/news      launcher news cards
GET /api/status    project/version/status metadata
GET /api/feed      combined status + news
```

The direct-IP deployment listens on TCP 3220. A domain is not required for this
phase because the service holds only public read-only content.

Plain HTTP must not be used once account/login features arrive. CML identity,
Discord linking, Minecraft ownership verification and session tokens belong
behind HTTPS.

The service deliberately does not host updater executables. The future launcher
can display versions from this feed while downloads and integrity checks remain
anchored to trusted release infrastructure.
