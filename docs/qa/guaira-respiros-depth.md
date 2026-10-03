# Respiros: final inspection pair

The first teaching grates retain their geometry, 4200ms period and 0/1200ms phases. After them, a native checkpoint at x624 precedes two independently phased outlets (x704–784 at 600ms, x880–992 at 2700ms). The96px dry island between them has a visible “ILHA SECA” sign. Waiting for each discharge to retract permits an intact walking completion; running, jumping and taking damage are unnecessary. The exit, corral sign, hut and rice worker move together to the x1088 exit bank.

Two optional native coins sit over a 32px one-way maintenance shelf at x576–608. Both the base floor and raised takeoff retain a fully visible native jump apex, including the helmet above the collision body. Returning from the shelf joins the same checkpoint and outlet route. Coins remain attempt-local. This changes neither the five-receipt progress schema nor campaign unlocks.

## Verification

- Automated offline production Input/WorldGame/Player harness, not manual browser play: frozen 877-frame keyboard/native-touch input replay completes intact without position or clock edits.
- All 252 initial phases complete the complete route with observed retraction. Another 252 departure fixtures independently verify the final pair. Original teaching timing and braking regressions remain covered.
- Native keyboard and touch cover optional coins, raised shelf jumps and airborne retreats, safe rejoin, final checkpoint death/recovery, three-cycle dry-refuge waits, pause/retry and completion gating.
- Production raster checks cover every final-pair phase in normal/reduced motion and ensure visible water exactly matches native dangerous envelopes, never the dry island.
- 36 focused Respiros tests passed; 1426 TypeScript (before the additional two retreat-camera regressions) tests and 3 JavaScript tests passed; typecheck, level/player/world validation and Vite production build passed.
- In this sandbox, npm run check cannot start the tsx CLI's Unix pipe (EPERM). Equivalent test/validation stages ran successfully via node --import tsx, followed by the regular TypeScript compiler and Vite CLI. This is not a claim that the npm wrapper itself passed.

Reproduce visual QA using node --import tsx tools/guaira/render_respiros_depth.mts OUTPUT_DIRECTORY, with RESPIROS_CANVAS_MODULE pointing to an installed @napi-rs/canvas if needed. This produces actual native-input production renders of arrival, final checkpoint, dry island, finish, maintenance shelf and raised jump. PNGs are QA output, not shipped game assets.
