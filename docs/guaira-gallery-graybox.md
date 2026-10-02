# Galeria dos Remendos: optional native route

Dedicated entry: `/guaira-galeria.html`. This optional service gallery does not register a campaign stage, change the five chapter conclusions or persist a save. MAPA always returns to `./guaira.html?at=bairro` without `visit`. Its label is “Voltar ao Bairro da Vala Seca”. No Oracle access was used.

The goal is “Abra as tampas rachadas e alcance o patamar de inspeção”. The local result is “ACESSO DE INSPEÇÃO ABERTO”. It opens a dry service passage; it does not restore neighborhood water.

## Geometry and native authority

The approved 704×432 px plan is unchanged: native 16 px tiles, native 14×24 px Player, two 3-tile breakable lids, ceiling-high solid walls,48 px-high passages underneath, short one-way return shelves and a solid exit staircase. All collision geometry is authored in `GuairaGalleryStage.ts`. The checkpoint bank is solid down to the base and cannot be reached from underneath the second shaft.

WorldGame, Input, Player and WorldLevel execute all movement, jump variation, ground-pound windup/recovery, impacts, head bumps, tile destruction, checkpoint capture, death and reconstruction. There are no new physics rules, fabricated impacts or completion events. The standard route uses two jumps followed by Down, two actual descents beneath walls, then three jumps up the exit. Running, items and damage are unnecessary.

Completion reads the live tiles and requires a live, grounded Player with feet exactly on the 192 px terrace and x≥656. At least one actual empty tile in each lid suffices: one 16 px hole is physically wide enough for Feka. Checkpoint acquisition never grants completion and is not required for it. No campaign exit is present. The completed attempt freezes world time, elapsed time, camera and geometry while allowing native sprite idle time, pause, mute and explicit exit.

Native death reconstructs the entry before the flag; after the flag it reconstructs A fully open, B fully intact and the helmet state captured by the native checkpoint. This is local canonical restoration, not persistence of mutable tile state. TENTAR synchronously clears both openings, checkpoint, result and held input. Disposal clears the local result/checkpoint and native event/frame ownership; reentry creates a fresh attempt.

## Camera and receiving surfaces

The camera keeps Feka's top at least 28 px below the screen top during high jumps, clear of the 23 px HUD. At a lid approach and native impact, the next receiving surface is visible. At a short return shelf, the lower floor is already visible before walking off it. Horizontal tracking keeps the actor visible while reversing. The vertical target interpolates across lid edges and near landings; ordinary camera changes are capped at 8 px per 60 Hz frame, and a falling actor never triggers an upward camera rebound. Load/respawn snaps are separate.

Central A impact at x 175 uses camera y 80: the 240 px shelf appears at screen 160. Resting on that shelf uses y 128: the 288 px gallery floor appears at 160. Central B uses y 176 to show the 336 px shelf at 160; resting on that shelf uses y 224 to show the 384 px floor at 160. The rightmost tile of each lid is outside its short return shelf. At x≥192 for A and x≥416 for B, framing previews the actual lower floor instead. For example, standing on A's right lip at x 210/feet 176 uses camera y 124 and shows floor 288 at 164, before breaking. This corrects the blind-fall risk without changing geometry or physics.

Independent review reproduced a 48 px down/up camera bounce within 33 ms on a right-edge return. The continuous target and descent constraint remove that rebound: the same input now stays at camera y 128 through the crossing, with a maximum 8 px/frame camera change over the measured route. Dedicated normal/reduced-motion regression tests cover both shafts.

At the highest portion of a held jump, the camera prioritizes the actor; a lower receiving surface may temporarily leave the screen. It is restored before the native break/launch into the descent. Reduced motion removes particles and shake but preserves the same necessary camera framing and physical timing.

## Reproducible proof

Focused command: `node --import tsx --test tests/guaira-gallery.test.ts`

Trace command: `node --import tsx tests/helpers/recordGuairaGallery.ts .tmp/gallery-proof`

`guairaGalleryReplay.json` contains fixed 60 Hz input event blocks. The harness replaces browser/audio/canvas boundaries only. It dispatches real keyboard or native canvas touch events; the route never writes player coordinates, velocities, tiles, checkpoint or result. The trace records every frame's inputs, player/velocity/ground-pound state, six live tile values, checkpoint, camera, simulation clocks and result. Summary hashes cover each complete JSON trace.

28 focused tests cover native authority/isolation; four complete keyboard/touch×normal/reduced-motion replays; deterministic retry; leftmost and rightmost single-tile openings; actual flag-skipping keyboard/touch routes; preserved 150 ms ground-pound recovery; outward and return paths through both shafts;240 walking/running/jump-hold/delay/reversal policies against intact walls; native head-bump widening; canonical checkpoint and helmet reconstruction; false-airborne/lower-shaft completion/checkpoint fixtures; retry; pause/Escape/blur/hidden/cancel; and terminal disposal/reentry.

Death/equipment and arrival-predicate fixtures are explicitly isolated from full traversal proofs. The 240 policy sweep is evidence against common native shortcuts, not a mathematical exhaustiveness claim. These automated tests establish route/collision/input/lifecycle behavior; they do not establish browser rendering, physical-phone usability, frame rate or human difficulty. The integrated painter is derived from live tiles. Its five tests distinguish cracked covers, safe caps, suspended partitions and real empty openings; no texture files are added.

## Host and art interface

The host uses `new GuairaGallery(canvas, status)`, `GUAIRA_GALLERY.id`, `finished`, `load(id)`, `toggleGalleryPause()` and the constant `mapReturnHref`. It owns the three semantic 44 px toolbar actions PAUSA/CONTINUAR, TENTAR and MAPA, the existing native touch helper, focus restoration and host lifecycle. The dedicated entry owns and releases its scene, controls, observers and frame callbacks. A pagehide ends the attempt, including a back/forward-cache visit; restoration creates a fresh attempt. Failed setup leaves plain TENTAR and MAPA controls. Page tests use the real Gallery adapter with simulated browser/device boundaries; injected result states test lifecycle only, not victory.

The agreed painter exports are `drawGalleryBackground(c,cameraX,cameraY,time,reducedMotion)`, `drawGalleryTerrain(c,level,cameraX,cameraY)` and `drawGalleryObjects(c,objects,cameraX,cameraY,time,reducedMotion)`. The adapter installs these native pixel painters for the dry workshop, cracked clay covers, continuous masonry, wood return boards and top-anchored service partitions. Feka and checkpoint retain their native renderers. Background details stay recessed; they do not paint replacement floors into broken holes.
