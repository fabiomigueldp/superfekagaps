# Bairro public-water payoff

The chapter's small Bairro trough stays dry until the current session accepts a
real `mayor-water-released` result from Prefeito. Native readiness is not an
accepted result. The adapter/session/host authority chain is unchanged.

`GuairaChapterWater` reads the owned snapshot, requires the Prefeito receipt,
matching result and attempt scene, matching session identity, and a live session.
It deliberately accepts historical generation numbers: subsequent selections and
replays preserve the original accepted receipt. The helper is not an import or
forged-object validator. No new serialization, URL, history, save or WorldGame
state exists. New chapter, disposal, reload and bfcache reset remain dry.

The five required results and optional Gallery/Relief navigation retain their
existing priority. The existing completion hint says “A água voltou. Os gaps
continuam. · 5/5 nesta sessão” only with both chapter completion and accepted
public water. When Feka is at Bairro, the canvas description adds “Bica do Bairro
com água nesta sessão.” No new control or live region is added.

## Art and paint

The dry stone trough and bronze outlet are baked into the existing 1920×1200
diorama. `GuairaBairroWaterData.json` is exported from the evaluated Blender
geometry, not the design mock. The runtime schema contains integer source-pixel
`bounds`, and source-pixel `bowl`/`fall` polygon vertices. The receiving plane is
inset one source pixel from the opening. Bounds are `[908,597,37,18]`, only 666
source pixels; data is 220 bytes minified.

The chapter composes the optional existing irrigation effect with the receipt
controlled trough. The new draw uses contained turquoise fills and two quiet
clipped highlights. It creates no canvas, image, mask request, timer or RAF. The
Bairro effect remains usable if the optional irrigation atlas fails to decode.
The existing irrigation atlas/scratch sizes, art, physics and motion are unchanged.

The existing map clock, at-most-30Hz idle repaint, suspension and actor ordering
are shared. Hidden document, blurred window, open JORNADA, active attempt,
disposed view/session and unready assets stop paint work. Reduced motion paints a
stable representative frame once per material/layout change. The clock excludes
hidden time. State and camera changes invalidate the full paint as before.

Full and partial paints use the same bounded water clip. This avoids vector-edge
coverage rounding differences when the new region joins the irrigation regions.
Partial restoration still repaints only those bounded regions, and Feka remains
last. Existing irrigation alone is pixel-identical before/after this clipping
refactor across 12 native-raster viewport/phase cases.

## Focused verification

- `guaira-chapter-water.test.ts`: real native Prefeito controls/adapter acceptance
  for both openings, Continue and paused Map, partial seals, wrong result
  scene/kind/session, repeated transition, genuine native retry and death,
  accepted Prefeito replay/duplicate, original receipt retention, restart/dispose,
  and real optional Relief cap negative. Four prerequisite receipts are explicitly
  fixtures; this test does not replay the full campaign or claim those fixtures
  are native victories
- `guaira-chapter-map-view.test.ts`: optional title/action priority, truthful
  count/hint/canvas description, failed irrigation mask with working trough,
  one RAF and 30 paints per 60 60Hz ticks, hidden/blur/modal freeze, retained
  callback rejection, no hidden catch-up, static reduced motion, replay
  suppression and late old wet decode unable to repaint a new dry view
- Selected existing host tests exercise actual pagehide/bfcache/reload source and
  host ownership. The final aggregate also passed the existing full native
  excursion journeys for both openings, with new assertions proving dry after
  optional Relief, wet after five real results, and retention on optional return
- `scripts/prove_guaira_chapter_water.ts` renders the production painter and final
  dry art with native Canvas. Eight cases cover desktop, 320px phone, compact
  landscape and DPR2, both with and without irrigation: zero full/partial pixel
  differences, zero water pixels outside exported masks, stable reduced-motion
  frames and visible motion. A deliberate overlap fixture preserves all 2,723
  opaque Feka pixels. These are offline raster checks, not browser/device FPS or
  gameplay screenshots

The 39 focused water/map tests, 2 selected host tests, both TypeScript projects,
level/player/world validation, Vite build and 45MB size gate passed. The `tsx` CLI
IPC socket was unavailable here; validators and size check ran successfully via
`node --import tsx` instead. No historical media was fabricated or removed.

Measured runtime helper plus vector is 883 bytes gzip. The bundled chapter-entry
comparison and production build size are recorded with the delivered proof;
the latter is 40,574,974 bytes, below 45,000,000. The author-supplied dry WebP
is 193,538 bytes, a 278-byte encoded increase. The existing diorama is replaced,
so there is no additional full-size runtime texture or decoded buffer.

The final integrated tree passed 1,246 TypeScript tests, 3 server tests, all three
validators, both typechecks, Vite and the size gate (141 files, 40,574,974 bytes).
Browser verification is a separate release gate, not implied by these checks.

## Portable art source

`tools/diorama/guaira/build_guaira.py` now includes `bairro_water_guaira.py`.
Render the baseline source from commit `f4106941e97a30e9e8911f30428319d6ddb92635`
and the new source into separate folders with the same Blender 4.3.2 settings.
Use `package_bairro_water.py` with those baseline/candidate PNGs and the baseline
WebP, then `export_bairro_water.py` on the new scene for the bowl/fall geometry.
The local packager preserves master pixels outside the 80×80 prop/shadow envelope.
All original scene objects, materials, camera, lights and routes stay unchanged.
The existing WebP92 encoding produces small RGB quantization differences outside
that envelope: mean maximum channel difference 0.134/255, maximum 14/255; alpha
is exact. These measured codec differences are distinct from authored changes
and are recorded in `tools/diorama/guaira/bairro-water-validation.json`.
