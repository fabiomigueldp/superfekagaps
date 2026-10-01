# Guaíra / Ossabravo experimental lab

Open `/guaira-lab.html` directly. Ossabravo is a provisional name. This is an isolated playable prototype, with no campaign or menu link and no introductory cutscene. It uses the existing `WorldGame`, `Player`, `Input`, `Renderer`, bitmap controls, Feka sprites, helmet, death animation and automatic retry. The ephemeral store never reads or writes campaign storage.

The dry red arena has a continuous horizontal floor at world y224, shown at screen y160 by the fixed x0/y64 camera. Cactus, distant irrigated rice and a closed irrigation gate are background scenery. Mysterious purple slime animates the skeletal bull; the prototype defines no ingredients or origin story.

## Controls

- Left/right or A/D: move
- Space, Z, up or W: jump with the normal hold/release behavior
- Down/S while airborne: sentada (normal ground-pound)
- Shift or X: run, as in the existing engine
- Escape or the native Pause/Continue control: pause/resume
- M: toggle sound
- Tentar: start a fresh fight with a helmet
- Mapa: return to the isolated Guaíra map at the corral; its Sair link returns to the existing game home

The ordinary engine touch zones provide movement, jump, run and sentada. Page controls use native buttons/links, accessible names and 44px-high bitmap faces; native Enter/Space activation remains owned by those controls. Blur/hidden-tab pause requires explicit resume. Reduced-motion preference disables camera shake, decorative bull bob/stride and warning flashing; direction cues and combat timing remain visible.

## Encounter contract

The bull locks direction at the start of a 42-tick charge warning or 48-tick low-bone warning. Each fixed tick is 1/60 second; catch-up is capped at 100ms. Six falling top hits defeat it. Brake/recovery opens the ribs for an ordinary jump or sentada; side contact never damages the boss. The charge's final swept collision is resolved with top contact, so a valid first-braking-frame stomp wins over the residual sweep. A descending player on the trailing swept edge safely bounces but cannot deal damage without touching the present body.

Charge stops leave narrow corner room, but low bones reach both edges. Stationary corner camping loses the helmet and then kills Feka. No custom player HP or melee attack exists. On defeat the lab intercepts campaign completion and remains available for pause, retry or exit.

The final edge-despawn bone can still collide over its physically traversed last tick after its current sprite is removed. This known one-tick visual boundary is recorded for later tuning; the swept collision intentionally prevents tunneling.

## Verification

`node --import tsx --test tests/guaira-*.test.ts` runs the lab constructor/lifecycle tests and frozen real-input replay. The replay fixture uses ordinary keyboard events through actual Input, Player and WorldGame. It wins in 1,019 frames (about 17 seconds) with all six hits and the helmet intact, exercises charges and bones, repeats deterministically, and changes no campaign completion. Separate tests cover both corners, the first braking frame, both trailing sweep directions, eight normal jump/sentada recovery cases, pause/blur/visibility, native page activation, touch cancellation, helmet/death/retry, reduced motion and victory isolation.

Both experimental labs reuse the base pause/resume transition so buffered hit-stop actions cannot leak across toolbar pause. The Turbosuco intro retains presentation cancellation and audio-pause behavior.

The production build retains `main` and `juiceLab` inputs and adds `guairaLab`. Its dedicated JavaScript is 13.09 kB raw / 5.46 kB gzip, plus the shared 1.43 kB / 0.69 kB bitmap toolbar and 2.67 kB / 1.28 kB HTML. The existing WorldGame bundle remains shared; campaign HTML does not preload the Guaíra entry. These are build sizes, not an FPS claim.

Offline proof images/video are kept outside the repository and explicitly labeled as actual-engine offline rendering, not browser screenshots. No prototype screenshot, custom-player entry, GIF or diorama proof is shipped under `public`.
