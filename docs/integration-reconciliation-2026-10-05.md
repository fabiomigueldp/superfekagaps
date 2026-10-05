Integration reconciliation — 2026-10-05

This follow-up closes the Factory tooling omission found after PR #2 and incorporates the newly published touch-rotation fix from 256d501. Modern ScreenOrientation changes cancel held and queued game input; the legacy window event remains the fallback. Disposal removes the modern listener, and a delayed legacy event cannot cancel a fresh gesture in the modern path.

The original Factory branch is merged with its four recovered helpers adapted to current atlas functions and source-matched caches. Five conflicts were resolved with the current runtime image, metadata, WorldMapView, integration fixture and canonical scene as the reference. Its image/metadata budget and transparency assertions are also recovered. The original pre-atlas proof files remain in eab1a34 history; current measurements and proof summaries are regenerated from current source.

Factory reproduction now stages output, repeats actual support/headroom and foreground-body ray checks, checks the twelve post/socket/tie/slab connections and rejects stale runtime inputs, changed scene caches and render files altered after their audit. Packaging validates the frozen projection contract and alpha frame, preserves published metadata and requires an explicit installation step. Text hashes normalize LF/CRLF so the same source is reproducible on Windows and Linux.

The new model correctly exposes raster overdraw in narrow phone panoramas. The 16×26 physical body has zero foreground equipment contacts. The conservative rounded pixel grid has 71 diagnostic contacts across the fixed portrait panorama scenarios; these are retained in the report, with their objects and paths, rather than treated as physical collisions or as proof that every opaque sprite pixel overlaps scenery. Runtime drawing is unchanged by the Factory tooling recovery.

Historical branch reconciliation records ancestry for the fifteen other audited remote branches. Thirteen have equivalent patches already reapplied to main; arcade audio assets are byte-identical and the full-height Turbosuco warning is incorporated and refined. Their reconciliation deliberately preserves the current file tree. This avoids repeating the old patches against later versions while retaining all original commits in reachable history. No remote branch or local backup is deleted.

Validation completed before merge:

- npm run check: 1,826 TypeScript tests and three Node tests, all content validators, both typechecks and the production build passed.
- Python Factory regression suite: nine tests passed, covering stale source/metadata, projection drift, clipped or modified renders, payload packaging and LF/CRLF portability.
- The current actor painter stays inside the published envelopes across idle/walking frames, both facings, subpixel anchors and all twenty viewport/mode scenarios.
- Blender 5.2.1 rebuilt the 1,055-object scene, passed the physical checks and verified twelve of twelve connected guardrail chains.
- The source-matched cache rendered a full 1920×1200 image at 192 samples. Packaging and the route-overlay review completed; the 179,548-byte candidate pair is below the 350,000-byte limit. Published runtime art/metadata remain unchanged.
- Production build: 210 files, 50,982,967 bytes, with 2,017,033 bytes of headroom below the 53,000,000-byte budget.

The compact native evidence is in docs/world/diorama/fabrica-reconciliation-verification.json. Reproduction commands and scope limits are in docs/world/diorama/fabrica.md. Large images, Blender caches and detailed per-ray reports remain in .cache/; the original Delicia safety snapshot remains in refs/backups/delicia-before-integration-20261005 and stash@{0}.
