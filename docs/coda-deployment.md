# Coda Web 0.1.0

Unlisted `/coda` route inside the existing landing application. No welcome
navigation, sitemap entry or public Coda card. robots.txt disallows `/coda`;
the route and API also send noindex headers. The URL itself is not a password:
Discord OAuth plus room membership protects every conversation operation.

## Implemented

- Discord identify-only OAuth with single-use, cookie-bound state and opaque,
  hashed, HttpOnly session cookies (Secure in production, seven-day expiry).
- Durable SQLite room history, named speakers and 2.5-second room updates.
- Every signed-in member can create private rooms; joining another member's room
  still requires a single-use 24-hour invite.
- Browser Coda resolves the authenticated Discord account through Orbis. A solo
  room receives that member's permitted DM profile and memory context; once a
  guest joins, only shared-surface/public caller memory is eligible.
- Hosts rename conversations, invite/remove guests, revoke outstanding invites,
  delete rooms and toggle listening. Guests can leave conversations themselves,
  and can converse and ask Coda within their joined rooms.
- Ask Coda retries saved messages without duplicating the user's message.
- Same Kilo sidecar session API used by HW-Coda, fresh session per reply, all
  tools denied, cleanup after each turn, per-member rate limits and room locks.
- Orbis supplies the same canonical Coda personality and caller-scoped memory
  used by Discord Coda. The current room's latest 80 messages (capped at 60,000
  text characters) also go to Kilo; other room transcripts never do.
- Enter inserts a newline; dedicated Send button; mobile conversation drawer.

This is conversational Kilo access. Shell work, project edits and background
jobs remain unavailable. Members can paste or upload up to four PNG/JPEG/WebP
images per message. The server decodes, strips metadata and normalizes them to
room-scoped WebP; every read rechecks membership. Kilo receives pixels only when
its provider catalogue confirms that the configured model supports images.

`/help`, `/memory`, `/format` and `/clear` are private browser commands. They are
not stored or sent to the model. Memory mutations derive the Discord ID from the
authenticated session; clear is host-only and refuses to erase shared history.
Replies render safe Markdown and six fixed semantic tones. Raw HTML/CSS, remote
Markdown images and unsafe link protocols are discarded. These features do not
alter the running Discord bot or its provider behavior.

Known deployment limitation (2026-10-03): authenticated upload, normalization,
preview, alt text, storage and room-authorized retrieval pass production checks,
but the selected Kilo vision completion returned HTTP 500 after accepting the
file part. Production therefore stays on the normal text route and treats image
content as metadata-only until the upstream vision route is manually repaired.
Do not claim pixel inspection while that limitation is active.

## Production deployment (existing Vienna host)

1. Pull `HowlingWhispers/HW-Landing` **main** in
   `/srv/howling-whispers/landing`. Require **Node 24 LTS** at `/usr/bin/node`
   (native `node:sqlite`); do not downgrade the Discord bot's runtime.
2. `npm ci && npm run build && npm run test:coda`. Vite emits `../dist-landing`.
   Publish those build files to the existing `/var/www/thehowlingwhispers.com`
   using the normal landing deploy procedure.
3. Copy `.env.coda.example` to `.env.coda`, mode 600 readable only by the service
   account. Populate Discord client ID/secret and owner ID from the existing
   server configuration, and reuse Orbis's internal bridge URL/secret.
   Reuse `CODA_KILO_BASE_URL`, `KILO_SERVER_USERNAME` and `KILO_SERVER_PASSWORD`
   from the running Coda sidecar. Never expose these to Vite or browsers.
4. Add `https://thehowlingwhispers.com/coda/api/callback` to the Discord
   application's OAuth2 redirect list. Keep existing redirects.
5. Install `deploy/hw-coda-web.service`, verifying its user, node executable and
   paths; `systemctl daemon-reload && systemctl enable --now hw-coda-web`.
6. Add `deploy/coda-nginx.conf` locations inside the existing HTTPS server block.
   Retain existing routes. `nginx -t` before reloading Nginx.
7. Check loopback `/coda/api/health`, public `/coda`, Discord login, room creation,
   a real Kilo reply, invite redemption in a second account, and denial of an
   unrelated third account. Verify room refresh, rename, listening, guest leave,
   guest removal, and that leaving preserves the room and its message history.
   In a solo room, confirm a known memory from the same Discord account is
   available; after inviting a guest, confirm private memory is excluded. A
   fresh unlinked account must answer unknown facts honestly.
   Upload an image, verify preview/alt text and member-only retrieval, then
   remove the member and confirm the image returns 404. Exercise all four slash
   commands and confirm they do not appear in the room transcript.
   Check logs for failures without printing environment files or credentials.

The source is deployable; it is not proof that the production service is live.
This workspace has no server SSH credential or deployed Kilo secret. A production
operator must perform steps 2–7 and report the measured result.

## Local verification

`npm run dev` proxies `/coda/api` to 127.0.0.1:3218. For real local OAuth, register
the matching localhost callback and set CODA_WEB_ORIGIN to the Vite origin.
Tests use in-memory SQLite and a stubbed generator; no mock sign-in route exists
in production. Back up `/var/lib/hw-coda-web/rooms.sqlite` using SQLite's backup
mechanism; backup access must be restricted just like the live room history.
