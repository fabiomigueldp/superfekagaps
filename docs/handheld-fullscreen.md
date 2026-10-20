# Handheld input and fullscreen correction

- World canvas menus use their pointer hit targets only. Canvas touches no longer queue an extra menu confirmation or pause. Legacy campaign tap-to-start remains available.
- Touch controls follow touch input and are suppressed while a gamepad is exposed by the browser, including touchscreen handheld PCs. Renderer, World hints, Guaíra and Delícia share this rule. Connecting a pad cancels pending input.
- The game requests native fullscreen on its document so chapter overlays and dialogs remain available. Canvas sizing fills the available aspect ratio in fullscreen and fits viewports smaller than the native resolution.
- Torbware's World toolbar requests fullscreen on the iframe itself. Origin- and source-checked messages synchronize the game's exit control and sizing. Other catalog players keep their previous behavior.
- Torbware integration is a narrow update to `src/player.ts`, preserving existing server edits. Source backup: `/tmp/feka-fullscreen-fuczqw03/player.ts`. Temporary Dockerfiles run language generation, Vite and prerender only, without typecheck or verification suites.

Validation: production build/publication through the repository publisher. No tests, typecheck, browser review or physical Xbox/ROG Ally validation were run, as requested.
