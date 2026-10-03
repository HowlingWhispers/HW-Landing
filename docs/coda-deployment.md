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

## Shared music (phases 1-4 landed against a fake provider; Spotify playback disabled)

Browser Coda can listen together through a music provider. The full dispatch
path is implemented and exercised end to end against an in-memory provider, but
the Spotify adapter declares no playback capabilities, so nothing real can play
yet. Members still cannot start music: there is no music UI, and a recognized
request ends in an honest explanation.

Landed in phase 1-3 (foundation):

- A provider-agnostic music layer under `server/music/`. Only `spotify.mjs`
  knows what Spotify is, including its environment variable names. Adding
  another service means adding one adapter.
- Provider tokens are sealed with AES-256-GCM under `CODA_TOKEN_KEY` and stored
  server-side only. A database copy alone cannot play anything in an account.
- OAuth connect, callback, and disconnect. The state is single use, expires in
  ten minutes, and is bound to the authenticated account that started it.
- Disconnect is local only. It destroys the sealed tokens and every opt-in that
  member held, which stops Coda controlling that account immediately. It does
  not revoke the grant on Spotify's side; members who want that remove Coda from
  Spotify's own connected-apps page, and the response says so.
- Access tokens refresh on demand under a single-flight lock, and rotated
  refresh tokens are persisted. A rejected refresh is terminal: the sealed
  material is deleted, the connection is marked reconnect-required, no retry loop
  runs, and Coda asks the member to reconnect. `authorized_at` is stored so the
  roughly six-month refresh lifetime is visible.
- Per-room opt-in. A member must connect an account and then explicitly join
  shared listening for that room. The roster is read on every request, so
  leaving or disconnecting revokes control with no stale window.
- Device discovery with provider-neutral selection policy. No usable device is
  a normal state with a written explanation, not an error.
- Track resolution keeps the same recording: candidates are grouped by ISRC, so
  a live take or remix is a distinct recording. Two close recordings is
  reported as ambiguous for Coda to ask about, never silently substituted.
- A strict music intent schema parsed out of Coda's reply. The model may only
  request an action using the member's own words; it never names a track id, and
  the server resolves the recording itself. Disconnect is not a requestable
  action. Malformed blocks are always stripped so internal markup cannot reach a
  member.

Landed in phase 4 (dispatch):

- `server/music/session.mjs` performs provider-neutral dispatch for play, pause,
  resume, skip, queue, and now-playing. A provider must declare each capability
  before dispatch will call it, so an adapter cannot be driven into a request it
  has not implemented.
- Track resolution happens once, before fan-out, so every listener receives the
  same recording. Ambiguity raises a question instead of playing.
- Each listener is attempted independently and the outcome is reported per
  listener. A rate limit, dead device, revoked token, or non-Premium account on
  one member never aborts the fan-out or affects anyone else's playback, and no
  failure is retried in a loop.
- The permission matrix is unchanged: asking for a track is allowed for any room
  member because it plays for those who opted in, while pause, resume, and skip
  require the requester to be one of the opted-in listeners. A member who is not
  opted in is never controlled.
- Disconnecting or leaving mid-session removes that listener from the next
  dispatch immediately. The opt-in is re-checked after the roster is read, so a
  member who leaves during device discovery is not touched either.
- Playback runs after the reply is stored and can never take it down. Any music
  problem becomes one short factual follow-up from Coda rather than a lost reply
  or a failed request.
- The room session record stores what started, on which recording, and when, so
  drift correction can be added later as a read of that row without changing how
  playback is issued.

Real Spotify playback methods and capability declarations are implemented. A
production deployment still needs the browser music controls built and a
Spotify developer app whose client id, client secret, and registered redirect
URI match `SPOTIFY_REDIRECT_URI` exactly. Playback requires a Spotify Premium
account on each listener's account.

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
