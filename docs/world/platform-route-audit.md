# Campaign moving-platform structural audit

Date: 2026-10-06. Source baseline: 1be0bf0f09fe155a412ac5e7e6263243a9ec3866; its production platform code matches 85cb4eab.

## Finding and correction

The 2-1 screenshot's bent loaded cable reflected a simulation fault, not merely a drawing choice: X and Y independently chased a sinusoidal target under a 55 px/s per-axis limit. 15 of 19 autonomous carriers departed their intended straight line; 14 missed the far terminal by more than 1 px during the bounded three-cycle inventory. 2-1:p2 missed by 54.3 px; 4-3:cab2 by 79.2 px.

All 27 non-arena movers nevertheless admitted local walking/running transfers in the old simulation. This was a physical-coherence, terminal-service and readability problem; the audit did not establish a main-route softlock.

The shared replacement is scalar progress along a fixed rail, with 350 ms cosine-velocity acceleration/deceleration ramps and 450 ms stops. Cargo is bounded at 90 px/s and Serra at 80 px/s, both below Feka's 120 px/s walking speed. Periods below are deliberately authored rather than silently extended at runtime. Switched/gated lifts and descending supports retain 55 px/s controlled travel and existing encounter/switch behavior.

Three justified coordinate corrections:

- 2-1:p1: home X 432 → 448, removing its deck's 16 px penetration into the departure container.
- 2-3:p2: home X 1088 → 1104, removing the deck and rider's collision with the departure container while descending.
- 2-1:p2: arrival X 1472 → 1456, so the deck ends flush at the receiving bank X 1520. Exact terminal service exposed this previously hidden 16 px overlap; the old shortened travel never reached it. Period 7400 ms is retained.

Level IDs, mechanism IDs, terrain tiles, pickups, foes, checkpoints, exits and save data are unchanged.

## Jump envelope and transfer method

Measured with actual Player.update and WorldLevel at 60 Hz: 14 × 24 px hitbox; gravity 0.5 px/frame²; launch−8 px/frame; walk 2 px/frame; run 3.5 px/frame; acceleration 0.3 px/frame. Full held jump rises 103 px and returns to its starting floor after 43 steps (716.7 ms). Displacement is 86 px walking or 150.5 px running at pre-existing maximum speed, or 80.3/131.8 px from rest. Releasing at 9 frames gives only 71 px rise and 550 ms flight. These are empirical discrete-engine figures, not the 64 px naive ballistic estimate that omits variable jump hold.

450 ms of terminal dwell is 27 physics steps: 54 px walking or 94.5 px running at speed; from rest, 48.3/75.8 px. A 64 px carrier deck is reachable from the authored nearby banks without requiring sprint speed. No inherited platform launch momentum was assumed.

The transfer suite uses actual WorldObjects, WorldLevel.transport, Player controls, WorldFoe updates, live launcher barrels, jet danger and tile hazards. Each gait searches 15 bounded scripts (three starting offsets, five hold lengths), requiring a clean real landing. Boarding also rejects a shared-height static catwalk and requires at least 8 px of genuine autonomous carry before accepting success. The two secret upper catwalks naturally hand idle passengers onto the dock; return boarding uses the exposed side of the departing carrier. All 27 non-arena movers have forward boarding/disembark witnesses. All 18 non-arena autonomous carriers additionally have late next-cycle boarding and reverse-trip witnesses. A failed bounded search would not prove impossibility; a successful local witness does not prove every input/phase or a full-stage playthrough.

## All 36 World moving uses

Coordinates and mount feet/bolts are world pixels. Motion periods are complete round trips including both stops. A dash means switch/encounter-controlled, not periodic. Every carrier has an explicitly authored pair of fixed mounts; ground feet span 12 px of actual solid top and wall plates lie inside solid walls. The first two mount records for rails are departure/arrival; for lifts/supports they are left/right.

| Use | Type | Home → destination | Period old→new(ms) | New peak(px/s) | Fixed mounts |
|---|---|---|---|---|---|
| 2-1:p1 | platform | (448,192) → (528,192) | 5000 → 5000 | 47.1 | (440,192) ground; (560,224) ground |
| 2-1:p2 | platform | (1216,208) → (1456,176) | 5400 → 7400 | 83.5 | (1248,320) ground; (1488,320) ground |
| 2-2:l1 | lift | (384,208) → (384,96) | — → — | 55.0 | (388,224) ground; (442,320) ground |
| 2-2:l2 | lift | (1168,176) → (1168,80) | — → — | 55.0 | (1172,192) ground; (1226,320) ground |
| 2-2:l3 | lift | (1936,176) → (1936,112) | — → — | 55.0 | (1940,192) ground; (1994,320) ground |
| 2-3:p1 | platform | (512,176) → (608,192) | 5000 → 5000 | 57.2 | (504,176) ground; (640,224) ground |
| 2-3:p2 | platform | (1104,160) → (1216,176) | 5000 → 5000 | 66.6 | (1096,160) ground; (1248,208) ground |
| 2-3:secretLift | platform | (1648,144) → (1824,80) | 5000 → 5800 | 89.2 | (1640,144) ground; (1856,224) ground |
| 2-4:p1 | platform | (288,208) → (496,192) | 5000 → 6300 | 88.8 | (320,320) ground; (528,320) ground |
| 2-4:p2 | platform | (1504,176) → (1760,144) | 5000 → 7400 | 89.0 | (1536,320) ground; (1792,320) ground |
| 2-5:left | lift | (80,208) → (80,160) | — → — | 55.0 | (84,224) ground; (138,224) ground |
| 2-5:right | lift | (240,208) → (240,160) | — → — | 55.0 | (244,224) ground; (298,224) ground |
| 3-2:crate1 | platform | (656,208) → (704,208) | 3600 → 3600 | 48.0 | (688,304) ground; (736,304) ground |
| 3-2:crate2 | platform | (1376,192) → (1424,192) | 3900 → 3900 | 41.7 | (1408,304) ground; (1456,304) ground |
| 3-3:sl | platform | (1600,128) → (1792,80) | 5000 → 6000 | 90.0 | (1672,224) ground; (1824,224) ground |
| 3-5:access | lift (gated) | (224,208) → (224,160) | — → — | 55.0 | (228,224) ground; (282,224) ground |
| 4-1:cab1 | platform | (272,208) → (512,160) | 5000 → 7800 | 79.0 | (304,336) ground; (544,336) ground |
| 4-1:cab2 | platform | (1376,192) → (1616,144) | 5000 → 7800 | 79.0 | (1408,336) ground; (1648,336) ground |
| 4-2:l1 | lift | (368,208) → (368,96) | — → — | 55.0 | (372,224) ground; (426,336) ground |
| 4-2:l2 | lift | (1136,176) → (1136,64) | — → — | 55.0 | (1140,192) ground; (1194,336) ground |
| 4-2:l3 | lift | (1952,176) → (1952,96) | — → — | 55.0 | (1956,192) ground; (2010,336) ground |
| 4-3:cab1 | platform | (272,208) → (528,144) | 5000 → 8200 | 80.0 | (304,336) ground; (560,336) ground |
| 4-3:cab2 | platform | (1424,192) → (1712,128) | 5000 → 9000 | 79.7 | (1456,336) ground; (1744,336) ground |
| 4-3:sl | platform | (1968,128) → (2160,80) | 5000 → 6600 | 79.2 | (1976,144) ground; (2280,224) ground |
| 4-4:p1 | platform | (256,208) → (512,144) | 5000 → 8200 | 80.0 | (288,336) ground; (544,336) ground |
| 4-4:p2 | platform | (1440,192) → (1712,128) | 5000 → 8600 | 79.8 | (1472,336) ground; (1744,336) ground |
| 4-5:left | lift | (80,208) → (80,160) | — → — | 55.0 | (84,224) ground; (138,224) ground |
| 4-5:right | lift | (240,208) → (240,160) | — → — | 55.0 | (244,224) ground; (298,224) ground |
| 4-5:transfer | platform | (112,144) → (240,144) | 4200 → 4800 | 80.0 | (144,224) ground; (272,224) ground |
| 5-5:access | lift (gated) | (224,208) → (224,160) | — → — | 55.0 | (228,224) ground; (282,224) ground |
| 6-1:sup1 | support | (1424,144) → (1424,192) | — → — | 55.0 | (1416,200) wall; (1528,200) wall |
| 6-3:l1 | lift | (352,208) → (352,96) | — → — | 55.0 | (356,224) ground; (410,320) ground |
| 6-3:sl | lift | (1792,208) → (1792,112) | — → — | 55.0 | (1796,224) ground; (1850,320) ground |
| 6-4:p1 | platform | (272,208) → (512,144) | 5000 → 7200 | 88.7 | (304,336) ground; (544,336) ground |
| 6-5:left | support | (80,160) → (80,208) | — → — | 55.0 | (84,224) ground; (138,224) ground |
| 6-5:right | support | (224,160) → (224,208) | — → — | 55.0 | (228,224) ground; (282,224) ground |

Seven rail termini previously had no solid ground directly under their endpoint center. They now use explicit nearby bank-mounted cantilevers; they do not infer attachment from decorative cranes. 6-1:sup1 uses side-wall bolts at (1416, 200) and (1528, 200) across its open gap. The 2-1: p 2 arrival support moved to (1488, 320) with its shortened terminal.

## Separate Delícia campaign

All 14 Delícia stages including both shrines contain 28 horizontal ferries and 9 lifts (37 moving floors). Its existing analytic one-axis sine motion already reaches its terminals and retains a rigid path. Its 37 deck-and-player swept corridors are clear of solid banks; no Delícia motion or level changes are included. Its jump is separately measured: 101.25 px rise, 683.3 ms same-floor flight, 198.17 px horizontal displacement at 290 px/s or 174.01 px from rest, without dash.

| Stage | Floor index | Type | Authored base | Travel(px) | Period(ms) |
|---|---|---|---|---|---|
| delicia-1 | 9 | moving | (3166,467) | 30 | 3927.0 |
| delicia-1 | 11 | moving | (3576,437) | 30 | 3927.0 |
| delicia-1 | 13 | moving | (4026,467) | 4 | 3927.0 |
| delicia-4 | 1 | moving | (446,467) | 25 | 5236.0 |
| delicia-4 | 3 | moving | (841,437) | 30 | 5236.0 |
| delicia-4 | 5 | moving | (1241,467) | 40 | 5236.0 |
| delicia-4 | 8 | lift | (1515,408) | 88 | 5712.0 |
| delicia-4 | 9 | moving | (1871,437) | 35 | 5236.0 |
| delicia-4 | 11 | moving | (2256,407) | 45 | 5236.0 |
| delicia-4 | 13 | moving | (2741,467) | 25 | 5236.0 |
| delicia-4 | 16 | lift | (3000,408) | 88 | 5712.0 |
| delicia-4 | 17 | moving | (3356,437) | 40 | 5236.0 |
| delicia-4 | 19 | moving | (3726,407) | 50 | 5236.0 |
| delicia-4 | 21 | moving | (4206,437) | 30 | 5236.0 |
| delicia-4 | 24 | lift | (4470,438) | 88 | 5712.0 |
| delicia-4 | 25 | moving | (4826,467) | 30 | 5236.0 |
| delicia-4 | 27 | moving | (5236,437) | 25 | 5236.0 |
| delicia-7 | 1 | moving | (446,467) | 40 | 5236.0 |
| delicia-7 | 3 | moving | (836,467) | 45 | 5236.0 |
| delicia-7 | 5 | moving | (1281,437) | 35 | 5236.0 |
| delicia-7 | 8 | lift | (1550,438) | 88 | 5712.0 |
| delicia-7 | 9 | moving | (1906,467) | 45 | 5236.0 |
| delicia-7 | 11 | moving | (2311,437) | 50 | 5236.0 |
| delicia-7 | 13 | moving | (2801,467) | 40 | 5236.0 |
| delicia-7 | 16 | lift | (3075,408) | 88 | 5712.0 |
| delicia-7 | 17 | moving | (3431,437) | 45 | 5236.0 |
| delicia-7 | 19 | moving | (3816,407) | 55 | 5236.0 |
| delicia-7 | 21 | moving | (4291,437) | 40 | 5236.0 |
| delicia-7 | 24 | lift | (4565,438) | 88 | 5712.0 |
| delicia-7 | 25 | moving | (4921,467) | 40 | 5236.0 |
| delicia-7 | 27 | moving | (5321,437) | 45 | 5236.0 |
| delicia-11 | 5 | moving | (1921,437) | 35 | 3927.0 |
| delicia-11 | 7 | moving | (2306,407) | 50 | 3927.0 |
| delicia-11 | 9 | moving | (2806,437) | 35 | 3927.0 |
| delicia-relogio | 5 | lift | (1525,408) | 88 | 5712.0 |
| delicia-relogio | 10 | lift | (3020,378) | 88 | 5712.0 |
| delicia-relogio | 15 | lift | (4485,408) | 88 | 5712.0 |

## Other moving-looking equipment and coverage

- World: 5 static boss daises are not moving carriers; 20 falling-platform surface runs (110 tiles) and 15 conveyors are inventoried separately. Falling tiles retain 150 ms contact, 250 ms arming, 300 ms visual fall, 1200 ms respawn behavior.
- Delícia: 11 crumble floors and 16 belts keep their separate simulation behavior.
- No released World campaign mechanism uses kind swing. The audit does not introduce pendulum mechanics where no actual pendulum route exists.
- Guaíra's distinct chapter and map transport must not receive World carrier timing; compatibility belongs to the shared motion helper tests.

## Validation and limits

TypeScript checks passed for both application and tools configurations. Focused run: 27/27 tests passed across adventure.test.ts and world-carrier-route-authoring.test.ts. This includes the existing all 30 stage/72 seal identity checks, normal/secret progression and geometric main-route connectivity, alongside the new 36 corridor/mount tests, 19 speed/terminal-service checks, real timed local transfers, canonical checkpoint reconstruction and 37 Delícia corridor checks.

The machine-readable inventory alongside this report records every moving use, its route, mounts, near surfaces, hazards, checkpoints and pickups. Baseline motion samples and jump-envelope evidence were produced outside production source. The report is simulation/authoring evidence; it is not visual browser approval, an all-collectibles completion run, or exhaustive control/hazard-phase verification. Full integration checks and representative visual review remain release gates owned by the integrating task.
