# Campaign jump-coin audit

Historical first-pass audit. Its fixed local witnesses were insufficient gameplay acceptance and are superseded by [the natural-approach correction](campaign-natural-coin-audit.md). The original observations below are retained for traceability.

Base: `d50b51123abbf903f47ee5c427be3c0c8699d046`. Scope: all 25 legacy arc groups in 13 campaign courses, 212 existing coins. Campaign total stays 542 coins.

## Finding and correction

The original authoring helper placed a 32 px sine bulge across every arc, regardless of movement speed, ground height or the actual landing. The new positions are sampled from actual `Player.update`, `WorldLevel`, conveyor carry and falling-platform updates at the shipping 60 Hz step. The shipped coordinate table has no simulator imports or per-frame authoring cost.

The 24 jump routes use a supported, naturally accelerated walk/run approach, then hold jump through landing. There are no injected velocities, physics changes or frame-perfect release requirements. The 25th group follows the existing `2-3:secretLift` home-to-arrival ride. It deliberately does not suggest jumping across the secret carrier corridor.

Full-held shared-Player motion rises 103 px; ordinary equal-height airtime is 43 frames. At full momentum its range is 86 px walking and 150.5 px running. A one-frame short hop instead rises 19.75 px and lands in 17 frames. The 150 ms boost window is not a complete-jump hold duration: releasing after nine frames cuts the ascent to 71 px. No global jump tuning is included here. Delícia uses a different physics engine and is outside this table.

## Before / after evidence

Counts compare the old and new coins against exactly the same real traversal witness and the actual 16 × 18 pickup rectangle. They are not maximum-possible counts from an exhaustive control search. Launch and landing coordinates below are player left edge / feet in world pixels. All intended landing rectangles support the whole 14 × 24 player body.

| Stage / route | Old collected | New collected | Launch → landing | Frames |
|---|---:|---:|---|---:|
| 1-1 First recoverable gap | 5/7 | 7/7 | (408.3,192) → (500.3,224) | 46 |
| 1-1 Lighthouse descent | 5/6 | 6/6 | (2200.3,192) → (2292.3,224) | 46 |
| 1-2 First broken bridge | 5/6 | 6/6 | (328.3,224) → (410.3,208) | 41 |
| 1-2 Second broken bridge | 5/6 | 6/6 | (728.3,208) → (810.3,192) | 41 |
| 1-2 Rising broken bridge | 6/7 | 7/7 | (1624.3,208) → (1702.3,176) | 39 |
| 1-3 Upper route entrance | 3/7 | 7/7 | (232.3,224) → (310.3,192) | 39 |
| 1-3 Upper route return | 5/7 | 7/7 | (1096.3,208) → (1184.3,224) | 44 |
| 1-4 Cliff stepping stone | 6/8 | 8/8 | (456.3,192) → (538.3,176) | 41 |
| 1-4 Long cliff descent | 4/9 | 9/9 | (1495.3,176) → (1649.3,192) | 44 |
| 2-1 Cargo roof transfer | 5/10 | 10/10 | (871.3,176) → (1032.3,208) | 46 |
| 2-3 Container roof to lower bank | 3/7 | 7/7 | (503.3,176) → (671.3,224) | 48 |
| 2-3 Optional secret shuttle ride | 4/9 | 9/9 | (1672.0,144) → (1848.0,80) | 174 |
| 2-4 High cargo roof descent | 5/10 | 10/10 | (935.3,144) → (1113.8,224) | 51 |
| 2-4 Dispatch roof descent | 5/10 | 10/10 | (2039.3,160) → (2207.3,208) | 48 |
| 3-1 Belt departure to receiving floor | 6/7 | 7/7 | (519.9,192) → (610.7,224) | 46 |
| 3-1 Tank roof to belt floor | 4/9 | 9/9 | (1111.3,176) → (1279.3,224) | 48 |
| 3-2 Optional maintenance catwalk | 2/5 | 5/5 | (1784.3,128) → (1866.3,112) | 41 |
| 3-4 First pressure-room descent | 5/10 | 10/10 | (903.3,160) → (1074.8,224) | 49 |
| 3-4 Second pressure-room descent | 5/10 | 10/10 | (1927.3,144) → (2105.8,224) | 51 |
| 5-1 Cold-stock descent | 5/10 | 10/10 | (503.3,192) → (664.3,224) | 46 |
| 5-1 Cold-stock raised exit | 3/11 | 11/11 | (1847.3,192) → (1976.8,144) | 37 |
| 5-4 Ice roof ascent | 4/10 | 10/10 | (551.3,192) → (680.8,144) | 37 |
| 5-4 Ice roof descent | 5/10 | 10/10 | (1895.3,144) → (2073.8,224) | 51 |
| 6-4 Final high descent | 5/11 | 11/11 | (1047.3,128) → (1229.3,224) | 52 |
| 6-4 Final bridge approach | 5/10 | 10/10 | (2103.3,144) → (2274.8,208) | 49 |

Across these witnesses, collection changes from 115/212 to 212/212. All 24 jump routes also collect every coin when the takeoff setup is shifted ±4 px.

## Preserved intent and compatibility

- All pickup IDs, kinds, order and counts match the baseline fixture across all 30 stages. The 330 non-arc coins, every seal/equipment pickup, and all route-cue positions stay exactly unchanged.
- `Draft.arc` retains historical seeds solely to preserve identity allocation and the existing route-cue proximity exclusions. `Draft.done` replaces coordinates by exact pickup ID after allocation. New coordinates never renumber later rewards.
- World 1-1's lower-beach/seal descent and its recovery steps remain exact and keep their existing native traversal tests.
- World 3-2's maintenance catwalk remains optional. Its ribbon finishes before the seal so the special reward stays visually distinct.
- The 2-3 container descent ribbon ends before its helmet, and the optional shuttle ribbon traces a real ride. No new carrier mechanism or carrier-motion change is included.
- No calibrated pickup rectangle intersects solid terrain. Every new coin stays at least 22 px from non-arc rewards. Carrier dwell time cannot stack multiple coins at one position.
- Terrain, enemies, checkpoints, secrets, exits, save schema and physics constants are unchanged.

## Verification and limits

- 74 focused coin tests pass: 25 exact traces, 48 shifted takeoffs, one complete pickup-identity/layout compatibility check.
- The same 74 tests plus the 3 existing opening-route tests pass with Player ceiling-contact fix `e689789` temporarily overlaid: 77/77. The Player source is restored before this coin commit.
- `tsc -p tsconfig.tools.json --noEmit` passes.
- Every approach frame must remain grounded, every launch must be unembedded, every route lands safely, and the whole trace rejects spike/lava contact.
- This is a local terrain/coin audit, not a full-stage playthrough or proof against every foe, barrel or jet phase. Existing combat and machine timing still require observing the safe opening; those hazards and their rules are unchanged. The carrier witness begins aboard the verified home terminal; boarding is covered by existing carrier tests, not newly claimed here.

Reproduce: `node --import tsx scripts/audit_jump_coins.ts`.
Regenerate after reviewing authored witnesses: `node --import tsx scripts/audit_jump_coins.ts --write`.
Focused regression: `node --import tsx --test tests/campaign-jump-coins.test.ts tests/world-opening-route.test.ts`.
