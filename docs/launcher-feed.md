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
GET /api/feed      combined status + news + mandatory base-pack metadata
GET /assets/CML-BasePack-v1.zip   mandatory branding/music pack
```

The direct-IP deployment listens on TCP 3220. A domain is not required for this
phase because the service holds only public read-only content.

Plain HTTP must not be used once account/login features arrive. CML identity,
Discord linking, Minecraft ownership verification and session tokens belong
behind HTTPS.

The service may host the mandatory non-executable CML Base Pack containing
Howling Whispers branding/music assets. Its SHA-256 is advertised in the feed
and must be verified by CodaLauncher before installation.

The service deliberately does not host updater executables. CodaLauncher and
CodaLoader binaries remain anchored to GitHub Releases with integrity checks.
