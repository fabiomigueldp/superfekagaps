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

The prepared QA preview loaded the matching module/CSS for `875e601`. At
1180×757 all six owned labels were visually associated with their islands.
ArrowRight focused Domínio while Reserva remained idle; native Enter selected
Domínio and started the existing journey. Natural sailing showed Feka aboard,
“Rumo a Domínio”, and only Skip; confirmed arrival restored the island heading
and Enter. The existing synthetic 28/30, 69/72 progress was retained.

At 472×303 the original 128-pixel labels stayed in bounds but dominated the
small islands. The bounded correction uses the same artwork at integer 1×
letter scale (64×22 visible art) inside 76×44 native targets for viewports below
640 pixels wide or 480 pixels high. The layout uses the same target dimensions.
Focused HUD/integration tests, both typechecks and build passed after this
correction (135 affected tests; Vite 1.45 s). Actual compact composition passed
at 472×303 and 590×378 on `2402c52`; all six selection targets resolved to the
correct region. Space preserved the current phase, Escape closed only overview,
and gameplay 1-1 → pause → map restored 1-1. No physical touch/FPS/GPU
measurement is claimed.

Main `2402c522bcd97f715f22e7a1d2c6f58e91f7f8c9` deployed on 2026-10-01.
The public URL `https://superfekagaps.vercel.app/` loaded matching
`index-BXUzM5MZ.js` / `index-C-4s6zen.css`; Vercel deployment
`7SnHPZtQsmxLw4tZgv9jxXo4Pxav` succeeded. Public smoke checked the six owned
labels, locked Domínio preview rejecting Enter, restored Costa arrival, and
unchanged normal progress 0/30 and 0/72. No test save was imported into production.
No deployment configuration, GitHub workflow or hook changed; Oracle and the
user's original working checkout were preserved.

## Idle native-control writes

A subsequent measured change guards identical visibility and transform values.
Omitting the legacy dock argument leaves travel positioning to the immediately
following route pass; explicit dock arrays (including `[]`) retain their prior
behavior. Both production callers were checked. The audited stationary Costa
pass falls from 17 hidden + 6 transform assignments to 0 + 0. Tests run 120
full close passes and 120 overview passes without repeated position setters;
real move/hide/show, invalid anchors, availability, keyboard and disposal still
work. Close → overview performs its necessary 12 visibility and 6 position writes.
These are setter counts, not browser frame-rate measurements.

The final tree passed 473 TypeScript + 3 server tests in 13.66 s, both TypeScript
projects, diff checks and a 2.02 s Vite build (489.69 kB JS / 151.76 kB gzip).
No art, projection, cache, transport state or save change belongs to this patch.

The idle-write patch shipped as `cff4bf3cdfff38146c527530ce57a6e8676ac7cc`.
Preview smoke covered close/overview/close, native Enter, natural 1-2 walking,
Costa→Porto departure and Skip, and actual 2-1 gameplay → pause → return with
both travel controls restored. Public deployment `69S1nHYdqnyK8CLfVuoMxk8HX3hs`
loaded `index-3jTQ3Ido.js`; normal progression and panorama/Space return remained
correct. The original worktree and Oracle remained untouched.

## Focus continuity findings

A user-flow pass reproduced three concrete cases on the deployed build where
the browser moved `document.activeElement` to `BODY` as a focused control hid:

- Arrow to an island name in overview, then Escape to close overview.
- Activate a departure sign with Enter as travel starts.
- Activate “Pular viagem” with Enter as arrival replaces that action.

The correction is limited to handing focus to an existing visible map control
when its current control becomes hidden or disabled. Background updates must
not steal focus. Route selection, travel, unlock rules and saves remain separate.

The focused regression set passed 149 tests, followed by the final aggregate:
479 TypeScript + 3 server tests in 13.90 s. Both TypeScript projects and diff
checks passed. Vite completed in 2.47 s (490.01 kB JS / 151.85 kB gzip).
The patch restores the panorama toggle after Escape from an island, root before
the focused sign hides, and enabled Enter (or root for a non-enterable preview)
after focused Skip disappears. It also captures focus before disabling Enter.

Preview `1e60e7b` loaded matching `index-CTpP91IR.js` and repeated all three
gestures successfully: overview toggle after Escape, map root after departure,
enabled Enter after Skip. Natural Porto→Costa arrival also handed focused Skip
to Enter; an independently focused header control survived another natural walk.
No arrival entered gameplay automatically. Main deployed as
`1e60e7bf1e6c28aa742fca339f4ed74c1b1eb3f6`, Vercel
`E9zxAG8w3vNmSoysTVow98EAQb1d`. Public smoke matched the bundle and restored
the panorama toggle after Escape from a locked island name. Normal progress,
Oracle and the original checkout were preserved.

Portrait coverage remains contract-level: native Chromium window-menu and edge
resize attempts did not change its dimensions. No DevTools or denied route was
used. Existing synthetic portrait DOM bounds do not prove real CSS rendering or
physical touch behavior; real browser coverage is desktop and compact landscape.

## Explain the actual progression gate

The public 0-progress walkthrough exposed ambiguous blocked-preview copy: the
Porto departure said only to complete the previous path, and compact landscape
hid even that hint. The selected preview now says “Prévia · Conclua 1-5” in its
persistent status, with the actual prerequisite name (“Joãozão na Ponte”) in the
full hint and accessible announcement. The phase ID is announced once.

A pure explanation helper defers eligibility to unchanged `isUnlocked`. Island
boss gates take precedence over local prerequisites; already-open secret bosses
have no lock reason. Seals remain optional. In-flight, loading and missing-route
feedback keep their own semantics. The live QA fixture is a reviewed artificial
fresh save used only on the prepared preview; production progress is untouched.

Final verification passed 486 TypeScript + 3 server tests in 11.67 s, both
TypeScript projects and diff checks. Vite built in 2.40 s, 490.49 kB JS /
152.05 kB gzip; CSS is unchanged. Actual browser copy and compact layout are
checked on the corresponding preview before production promotion.
