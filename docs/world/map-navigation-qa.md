# Six-island navigation hierarchy

The overview now identifies each island with its own numbered, non-directional
wooden name board. Phase markers and departure arrows belong to the close view.
Selecting a board approaches that island using the existing journey; selecting
the current island preserves its selected phase. Returning from a locked preview
to the actual arrival island restores the arrived phase. Cross-region travel is
headed “Rumo a …” until arrival. Save IDs, gates and gameplay are unchanged.

Overview arrow keys focus the six native buttons; Enter/Space opens the focused
island, and Escape closes the overview before leaving the map. The six 128×44
targets retain full accessible names and locked-preview states. The original
bitmap lettering is drawn over new Blender boards (14,464-byte optional atlas).
No overview leader lines can be mistaken for physical routes.

Loaded terrain/path passes wholly outside the viewport are now omitted with a
conservative 24 CSS-pixel effect gutter. Independent docks, vehicles, connections,
partially visible terrain and procedural fallback retain their existing draws.
A no-op Canvas audit of a fully loaded Costa close view reduced terrain draws
6→1 at 390×740 and 6→2 at 1200×750. Pure scene command counts fell 917→662 and
917→718; integrated bitmap submissions fell 26→21 and 26→22. These are command
counts, not browser FPS or GPU-memory measurements. Lazy loading is unchanged.

## Automated verification, 2026-10-01

- 469 TypeScript tests and 3 server tests passed; aggregate elapsed 15.18 s.
- Level, player-asset and world validators passed (30 phases, 260 sprite frames).
- Both TypeScript projects, production build and diff whitespace checks passed.
- Vite build: 1.31 s; JS 489.52 kB / 151.69 kB gzip, CSS 19.66 / 4.73 kB gzip.
- Tests cover six-island label ownership/selection, preserved phase/arrival,
  keyboard focus and Escape isolation, locked preview, optional atlas failure
  and disposal, native target bounds, and culling command equivalence at edges.

Browser verification follows publication of this exact tree to the existing
prepared QA preview. Production remains on the prior verified release until
desktop and compact composition and navigation have been checked there.
