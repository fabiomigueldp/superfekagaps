# Guaíra campaign integration

## Path finish — 2026-10-15, revision 6

The ground curbs now form six continuous runs of fitted stones, including the small corner segments that previously left gaps. The rice bridge has founded stone heads, connected timber bearers, fitted rails, iron joinery and sloped approaches matching the native walking heights. Chapter signs reserve Feka's silhouette during layout instead of moving into neighboring signs afterwards; outward rounding keeps nearby placements available at fractional camera coordinates. The shared layout was checked at all 22 Guaíra/Delícia entrances across six viewport sizes. [Comparison, detail renders and walking video](guaira/path-finish-2026-10-15/index.html), [editable source and reproduction](guaira/path-finish-2026-10-15/README.md), [verification](guaira/path-finish-2026-10-15/verification.json).

## Entrance finish — 2026-10-15, revision 5

The workshop entrance now has a fitted stone arch, shaped door boards, hardware and a seated threshold. The corral crest is carved, the trough and two vents have real cavities, and the relief collector's inclined grille sits over an opening cleared from the old paving. The inspection hoist has supported machinery, guides, carriage and bracing; its boarding steps meet a joined street apron. Eight phase locations, twelve walking routes, terrain, water surfaces and transport anchors retain revision 4 coordinates. [Comparison, detail renders and walking video](guaira/entrance-finish-2026-10-15/index.html), [editable source and reproduction](guaira/entrance-finish-2026-10-15/README.md), [verification](guaira/entrance-finish-2026-10-15/verification.json).

## Phase landmarks — 2026-10-15, revision 4

Each of the eight phase entrances now has a recognizable modeled place and a named Blender collection/arrival marker. Ossabravo's dry corral has a dedicated gate branch off the main street; the stair approach stays separate. Paired A/B controls, two rice-field pressure vents, patched workshop access, a relief gauge/return pipe and a small inspection hoist connect the map's scenery to the actual phase mechanics. The native panel names the selected place, and G/A signs distinguish the two optional entrances. Seven existing phase positions, airport anchors, camera and water surfaces retain their coordinates. [Interactive phase locations, comparison and video](guaira/phase-landmarks-2026-10-15/index.html), [editable source and reproduction](guaira/phase-landmarks-2026-10-15/README.md), [verification](guaira/phase-landmarks-2026-10-15/verification.json).

## Landscape finish — 2026-10-15, revision 3

The coast now has variable erosion recesses and a more tapered foot. Fitted masonry closes the civic wall against the staircase, and a founded stone cistern replaces the old reservoir boulder. The sloping water outlet is cut through the masonry; the channel, service deck and bank plants have grounded supports. The terrain top, walking/flight anchors, camera and water meshes retain their coordinates. [Comparison and walking video](guaira/landscape-finish-2026-10-15/index.html), [editable source and reproduction](guaira/landscape-finish-2026-10-15/README.md), [verification](guaira/landscape-finish-2026-10-15/verification.json).

## Terrain revision — 2026-10-15

The landing clearing and island now share one closed terrain mesh. Rounded banks, irregular sediment layers and gentle dry relief replace overlapping cliff panels and the separate airport plinth. Walking projections and flight anchors are unchanged; beauty, depth and restored water were exported from the revised Blender source. [Terrain comparison and video](guaira/terrain-polish-2026-10-15/index.html), [editable source and reproduction](guaira/terrain-polish-2026-10-15/README.md), [verification](guaira/terrain-polish-2026-10-15/verification.json).

## Native island revision — 2026-10-13

The integrated World map now walks Feka through an authored Guaíra network, using the shared journey state, actor animation, controls and HUD. Flight arrival starts at the airport path; departure returns there before flying. All eight phase/optional entrances have their own exported 3D position. Returning from a phase restores the entrance actually visited, while stage selection is saved only on physical arrival.

The Blender revision replaces overlapping paths with joined paving, supported stairs and fitted bridge planks. Geometry, projection depth and aircraft clearances were checked together. Browser verification now includes arrival, walking, reversal, all eight phase entries/returns, narrow viewports and departure; the earlier browser limitation below applies to the original integration only. [Review with comparisons and video](guaira/native-map-2026-10-13/index.html), [editable source and reproduction](guaira/native-map-2026-10-13/README.md), [verification evidence](guaira/native-map-2026-10-13/verification.json).

## Campaign and compatibility

The authored route is Costa → Porto → Fábrica → Guaíra → Serra → Reserva → Domínio. Guaíra is a named chapter region, not a renumbering of the released numeric worlds. The original 30 stage IDs, 72 seals, records and checkpoints remain unchanged. The chapter contributes five completion receipts and optional Galeria/Câmara completion: 35 required campaign sections in total.

A new save opens Guaíra after 3-5. Finishing 3-5 presents its region/flight chooser. The mayor's genuine water-release result opens Serra. The former Factory–Serra path remains a maintenance shortcut after this gate. An imported pre-chapter v1 save that already completed 3-5 retains its earned Serra access through `legacySerraAccess`; it does not receive fabricated Guaíra receipts. Imports/exports include the additive versioned chapter object while retaining the established storage key and v1 campaign envelope.

## Chapter persistence

Only durable facts cross sessions: chosen opening, contiguous completed scenes, current/next selection, interrupted scene ID, optional completions and audio-enabled preference. Attempt/generation tokens and native game objects are never restored. Real, living runtime completion is saved immediately, before pressing Continue or leaving the map. Reloading an unfinished scene resumes from its native start; earned receipts survive. Replay keeps earned progress. Campaign volume/shake preferences apply to required and optional scenes, with reduced-motion shake suppression.

Chapter updates reread the shared save and merge earned chapter facts monotonically, retaining concurrent campaign changes. Campaign persistence merges newer chapter facts to protect stale/bfcache pages. Invalid saves remain protected until explicit valid import. Failed storage is visible; cross-page flight arrival is refused if persistence fails, keeping the live source and retry/cancel controls available.

The optional Turbosuco victory is written idempotently in the campaign update loop at real victory, as well as on safe return.

## Flight and geography

Original STOL courier, 32 genuine headings, moving propeller/flaps, acceleration, climb/cruise/approach and braking; no mirroring of perspective frames. Dedicated crossings support Factory ↔ Guaíra ↔ Serra with explicit runway anchors on the authored dioramas. The fixed global atlas retains old numeric region placements and places Guaíra east of the factory. Grounded terminal overlays extend Factory/Serra without moving their existing routes.

The modal owns one flight and commits arrival at most once. Skip succeeds only after required assets load; cancel keeps the source. Hidden/blurred windows stop elapsed travel. Reduced motion uses the short calm mode. Art failure offers retry or cancel and never reports arrival. Effects use an isolated effects-only WorldAudio route with the user's levels/mute preference and are disposed with the flight. Artistic listening remains a review task, not a tested claim.

## Verification

The integration used one aggregate TypeScript test pass plus directly affected reruns for intentional gate/receipt-label changes and native-menu test harness assumptions. Relevant checks cover migration, concurrent chapter writes, live completion before navigation, native-start resume, optional scenes, stale callbacks, retry/cancel, failed-save flight retry, immediate salon victory, map transport and keyboard controls. Level/player/world validators, both TypeScript projects, production build and size checks ran on the integrated source.

Actual browser verification belongs to the immutable preview before promotion: main native menu, Factory unlock → Guaíra flight, loading/cancel/skip/reduced motion, chapter resume/optional completion, mayor → Serra return, reverse flight, failed-storage handling, compact viewport and console errors. Local Chromium and cloud-browser localhost were blocked in this executor, so this commit does not claim that runtime browser pass, physical touch testing or full-campaign playthrough.

Automatic Vercel deployments remain disabled. No Oracle deployment is performed by these changes.
