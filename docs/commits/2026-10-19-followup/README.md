# Commit technical records: helicopter and recurring background activities

Reviewed on 19 October 2026. This supplement covers all ten commits after `9c4c6bd` through `fed12cf`: one documentation commit and nine gameplay commits. It extends the [previous 23-record review](../2026-10-19/README.md). The original hashes and messages remain unchanged.

Only `d35e790` has no original message body in this range. The other messages already explain their intent; these records add exact-revision symbols, state/timing details, patch inventories, asset roles and publication provenance. New commits after the fixed endpoint are outside this review.

| Record | Original subject | Documentation gap addressed |
| --- | --- | --- |
| [`6557895`](6557895.md) | docs(history): complete technical records for 23 recent commits | Body present; source map added |
| [`4057d1a`](4057d1a.md) | feat(hipotetico): integrate helicopter scene artwork and audio | Body present; source map added |
| [`7ee812e`](7ee812e.md) | feat(hipotetico): finish helicopter arrival choreography and native preview | Body present; source map added |
| [`d35e790`](d35e790.md) | Prevent premature interruption of Bastion tower RPG and rubble search sequence | Subject only; detailed record added |
| [`6f6f49a`](6f6f49a.md) | feat(hipotetico): refine helicopter missile ignition and staged destruction | Body present; source map added |
| [`34599ad`](34599ad.md) | feat(hipotetico): refine helicopter wreck physics and courtyard interaction | Body present; source map added |
| [`e086d2b`](e086d2b.md) | feat(hipotetico): choreograph flock volleys and enrich recurring background actions | Body present; source map added |
| [`529aa16`](529aa16.md) | feat(hipotetico): stage background discoveries and short pursuits | Body present; source map added |
| [`0e96e46`](0e96e46.md) | feat(hipotetico): add staged scavenging with planted body mechanics | Body present; source map added |
| [`fed12cf`](fed12cf.md) | polish(hipotetico): articulate scavenging motion and ground effects | Body present; source map added |

## Integration and ownership at fed12cf

| Component | State owner / entry points | Integration |
| --- | --- | --- |
| Helicopter interlude | `HypotheticalBackdrop.helicopter`, `HypotheticalHelicopter.update()` | Arrival mapping in `HypotheticalHelicopterTiming`; pose/art in `HypotheticalArt` and `HypotheticalHelicopterArt`; cues through `HypotheticalModel` → `HypotheticalGame` → `HypotheticalAudio`. |
| Missile motor | `ScenicRocket.motorAge`, `advanceRocketMotor()` | Shared by helicopter and tower; ignition depends on clearance, while their flight speed remains scene-specific. |
| Aircraft contacts | `stepAircraftBody()`, `aircraftPoint()` | Drawing and support use the same projected/flattened shape. Barrier and paving state belong to the helicopter scene. |
| Tower discovery | `HypotheticalAftermath.tower` and `tower.search` | Landmark opening takes planning priority; framing tolerance changes separately in `4057d1a` and `d35e790`. |
| Flocks | One `AftermathFlock` per yard | Shared trajectory for bird motion, rifle lead and projectile intersections; separate art module. |
| Discoveries / pursuits | One `AftermathEscape` with two entries per yard | Resident reveal/run/fall persists after the active pursuit; marks and entry state remain owned by the yard. |
| Ground scavenging | One `AftermathForage` referencing that yard’s escape object | Uses eligible completed entries once; pose alignment, opaque cover and removal share their staged clock. |

The secondary director checks tower work before escape and forage work, then selects ordinary actions. This is a planning priority, not a foreground input lock. Incidental events and new flock arrivals are gated while major passages are reserved. These components remain background scene systems.

## Clocks and coordinates

- Simulation timings in the records are native 60 Hz steps unless explicitly described as video fps. A 30 fps exported study can still sample a 60 Hz simulation.
- Arrival `storyTick` is mapped with `arrivalBeat()` / `arrivalStoryTime()`; the secondary director has its own tick and active-passage age. Do not substitute one clock for another.
- Contact-relative times such as `impactAge` and `motorAge` start from physical events. The observed launch/contact times in a study are not universal fixed delays.
- Actor roots use scene/world x; many prop/body y coordinates are relative to the rear-street baseline. The distant dinosaur rig uses `AFTERMATH_SCALE`. `dinosaurHeadPoint()` operates in the rig’s native coordinates before world placement.

## Finite actors, repeated actions and persistence

Ordinary material performances can repeat. A yard’s two escape residents cannot be started again after `begunAt` is set. Forage reuses a completed fallen resident, records `removedAt` under opaque cover, and cannot recreate it. Flocks have their own bounded arrivals, feather lifetimes and fading remains. Tower destruction and search remain one-time state in the current encounter. These are distinct lifecycles; none should be inferred from the looping material score.

## Assets and evidence

Runtime scene artwork is procedural TypeScript/Canvas; scene sound is synthesized through the existing effects route. Review PNGs, MP4s and JSON files under `docs/world/hipotetico/` are authoring artifacts and are excluded from the normal game build snapshot. See each patch inventory for the exact source and output changes.

A directed composition with held camera/player positions documents animation and state. It does not exercise a complete player-controlled fight or audio mix. Historical inspection statements are retained as original author records. This documentation task runs no test suite, typecheck, browser review or art renderer. Successful retained build/publication receipts establish only those operations.

## Reading the attached Git notes

The ten summaries are attached to their original commits in `refs/notes/commits`, supplementing the previous 23 notes. The Markdown records remain the GitHub-browsable copy.

```sh
git fetch origin refs/notes/commits:refs/notes/commits
git log --show-notes=commits
git notes --ref=commits show d35e790
```

Notes are not fetched by a normal clone. The explicit fetch above does not force-overwrite diverged local notes; reconcile them before retrying if Git reports a conflict.
