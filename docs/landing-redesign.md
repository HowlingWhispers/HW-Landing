# Coda's workshop: Howling Whispers discovery hub

The welcome site covers the whole ecosystem: projects, public documentation,
creative work, prototypes and community. Existing hash aliases still work.

## New content and navigation

- Ten project directions, including private/reserved work with honest labels.
- Documentation tab: nine reviewed public document snapshots, full-text search,
  project filters, deep-linked Markdown reader, source links and capture dates.
- Creations tab: official music channel and Vesper Hollow: Bellflame entry.
- Experiments: Coda’s Den and Bellflame, with direct entry points and clear
  descriptions of what each experiment explores. Core projects remain in Projects.
- Homepage features different project areas and architecture reading selections.
- Snow-white, ice-blue and cyan theme, optional dark theme and original Coda art.

Document bodies are bundled in `src/public-documents.json`; readers work without
GitHub calls or credentials. This is an explicitly selected public collection,
not an automatic mirror of every repository file. Update snapshots deliberately
from public sources. Capture dates are retrieval dates, not release dates. The
reader notes that snapshots may differ from current implementation. Source
relative links resolve against the original GitHub document. HTML is skipped,
remote images are omitted and unsupported URL schemes are refused.

Private repositories have descriptive entries without private document imports
or inaccessible source links. Coda’s Den `/coda` is now discoverable from
Experiments at the owner’s request. Its route, music, room permissions, backend
and UI source are unchanged.

## Artwork

Asset: `public/art/coda-workshop.webp` (1536 × 1024, approximately 267 KB).
Created with the built-in image generation tool, then encoded to WebP for the
website. No existing public artwork was replaced.

Prompt: A clearly adult anthropomorphic female Alaskan Malamute beastfolk named
Coda, snowy white fluffy fur with pale ice-blue patches and cyan highlights, no
black fur, upright canine ears, fluffy tail, expressive blue eyes, warm
mischievous smile. Fully clothed in a cozy blue cardigan, holding her official
clipboard. Welcoming creative workshop with sketchbooks, story maps, headphones,
music paper, a terminal monitor and worldbuilding books. Painterly fantasy
editorial illustration, snowy daylight, cyan glow, blue and white palette,
hints of lavender. Wide 3:2 composition, Coda right of center, airy pale blue
space at left. No text, watermark or childish proportions.

## Validation

Production build passes, 79 server tests pass and 7 existing UI tests pass.
Browser verification at 1440 and 390 pixels covers all seven tabs, horizontal
overflow, artwork decoding, documentation search and empty-result reset, project
filtering, document navigation/return, project availability filtering, persisted
themes and uncaught runtime errors. Desktop and phone screenshots inspected.

Deployment continues through the existing Vienna host workflow. A GitHub commit
does not deploy the site by itself.

## Social previews

Open Graph and Twitter metadata use `/coda-social-preview-v2.png` (1200 × 630),
matching the Coda artwork and snowy palette. The new filename replaces the old
green `og-banner.png` metadata reference. Width, height, type and alternative
text are explicit. To regenerate the raster from its editable SVG source, run
`node scripts/render-social-preview.mjs`.

After deployment, old Discord messages may retain their cached preview. Share
`https://thehowlingwhispers.com/?v=coda` to request a fresh preview. This uses the
same homepage; it does not change the canonical URL.

## Clear opening message

The homepage leads with “Build worlds. Bring characters to life. Play their
stories.” It explicitly identifies AI-powered roleplay, worldbuilding and
interactive storytelling, with persistent RPG experiences framed as a development
direction. A short Orbis / Speculus / Fabula explanation connects world creation,
roleplay and developing gameplay systems. The wider directory, creations and
experiments remain available. Fallback HTML, metadata and share artwork use the
same clear purpose. The updated PNG has a new v2 filename for social previews.
