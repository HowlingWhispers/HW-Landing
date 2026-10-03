# Howling Whispers project hub

The welcome site is a responsive project directory and starting point for the
Howling Whispers ecosystem. It retains the existing hash routes: welcome,
projects, experiment, community and archive, including their legacy aliases.

## Visitor experience

- Midnight blue surfaces, cyan actions and violet accents, with a light theme.
- A starting-point selector for worldbuilding, roleplay and community.
- Six project cards with text search and availability filtering.
- Speculus directs visitors to Orbis rather than a standalone simulator boot.
- Project descriptions distinguish experimental tools, prototypes and backend
  development; no runtime health or automatic release feed is implied.
- An interactive ecosystem explanation and Discord, Reddit and GitHub links.
- Chatty remains in the archive, with repository setup instructions and the
  existing legacy-site link.

Coda's Den remains available through its existing /coda route and private-link
entry. The redesign does not change its source, music layer, authentication,
room data or server configuration. No public navigation link to it is added.

## Maintenance

Project cards are curated in src/App.tsx. Keep availability and descriptions
aligned with repository evidence. A Try now card indicates a navigation entry,
not a production health check. Shared music remains implemented in Coda's Den.

## Validation

Build, 79 server tests and 7 UI tests pass. Browser checks cover all five hash
routes at 1440px and 390px, horizontal overflow, search/reset, availability
filters, starting-point switching, theme switching and uncaught runtime errors.
The page has also been inspected in desktop and phone screenshots.

Deployment uses the existing Vienna host workflow. This source change alone
does not publish the updated welcome site.
