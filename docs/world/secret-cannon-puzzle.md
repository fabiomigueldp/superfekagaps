# Reserva Especial: deliberate secret-cannon routing

The 5-3 secret exit explicitly requires the pressurized ice target `st`.
Previously its belt `sb` started leftward, carrying `launch132`'s barrels straight
into that target without player input. Its existing switch `ss` therefore sent
barrels **away** from the secret instead of solving it. This contradicted the
steering puzzle described in `campanha.md`.

The correction changes only the secret belt's authored default to rightward.
A ground pound on the existing, safe lower switch reverses it leftward; a real
pressurized barrel must then travel to and break the ice. The switch does not
activate the target directly. The cannon continues its normal repeatable cycle,
so missing a barrel never requires a restart. A short Feka comment at tile 100
explains the pound, the barrel/ice connection and the high exit; the existing
route now includes the switch.

No terrain, cannon, target, switch, checkpoint, exit, pickup, reward, enemy,
engine damage rule or timer changes. All existing IDs and pickup coordinates
remain intact; the guidance comment is appended as `5-3:d1`. The earlier ungated
`5-3/t1` and `3-2/t1` demonstrations are unchanged.

## Regression coverage

`tests/world-secret-cannon.test.ts` uses the production `WorldGame.load` and
`WorldGame.update`, the real Player and collision system, and normal input states.
It resumes at the actual tile-94 checkpoint with no helmet, invincibility,
position warps, mechanism activation calls, injected projectiles or forced
completion. DOM/audio devices are stubbed. This is a deterministic gameplay
harness, not a browser or full-stage playthrough.

Ten regressions cover:

- authored pressure/link/exit/reward invariants and the safe control cue;
- 30 seconds beside a genuinely running cannon without a pound: ice stays intact;
- jumping to and overlapping the high secret exit, then waiting another 30 seconds
  without a pound: the secret stays locked;
- actual jump + pound, barrel impact and damage-free secret completion across
  five observed shot phases, including a 40-second wait;
- the original upper seal collected along the successful secret route;
- normal-exit completion without operating the switch or opening the target;
- checkpoint reload restoring the closed puzzle, and a second successful solve.

The normal path and the secret finish are both replayed from the last checkpoint.
The unchanged earlier course is not claimed as a newly observed full playthrough.

Run the focused test with:

```sh
node --import tsx --test tests/world-secret-cannon.test.ts
```

The worktree's complete equivalent check pipeline passed: 551 TypeScript tests,
3 JavaScript tests, level/player/world validation, both TypeScript projects and
Vite production build. The `npm run check` wrapper itself could not start because
this environment rejected the tsx CLI's temporary IPC socket (`listen EPERM`).
The same checked-in test and validation files ran successfully via Node's tsx
loader, with no code or configuration changes to bypass a test.

```sh
node --import tsx --test tests/*.test.ts
node --test tests/*.test.mjs
node --import tsx scripts/validate_levels.ts
node --import tsx scripts/validate_player_assets.ts
node --import tsx scripts/validate_world.ts
npm run typecheck
node node_modules/vite/bin/vite.js build
```

Vite retains the existing advisory about a bundle exceeding 500 kB.
