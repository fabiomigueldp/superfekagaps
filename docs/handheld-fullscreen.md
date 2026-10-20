# Handheld input and fullscreen correction

- World canvas menus use their pointer hit targets only. Canvas touches no longer queue an extra menu confirmation or pause. Legacy campaign tap-to-start remains available.
- Touch controls follow touch input and are suppressed while a gamepad is exposed by the browser, including touchscreen handheld PCs. Renderer, World hints, Guaíra and Delícia share this rule. Connecting a pad cancels pending input.
- The game requests native fullscreen on its document so chapter overlays and dialogs remain available. Canvas sizing fills the available aspect ratio in fullscreen and fits viewports smaller than the native resolution.
- Torbware's World toolbar requests fullscreen on the iframe itself. Origin- and source-checked messages synchronize the game's exit control and sizing. Other catalog players keep their previous behavior.
- Torbware integration is a narrow update to `src/player.ts`, preserving existing server edits. Source backup: `/tmp/feka-fullscreen-fuczqw03/player.ts`. Temporary Dockerfiles run language generation, Vite and prerender only, without typecheck or verification suites.

Validation: production build/publication through the repository publisher. No tests, typecheck, browser review or physical Xbox/ROG Ally validation were run, as requested.

## Continuity and fullscreen ownership

- Gamepad resets now suppress only the individual held commands that need a fresh press. Left/right and run are read immediately from the device when gameplay resumes, including World respawns and Hipotético act changes. A held run button no longer prevents menu navigation or confirmation.
- Keyboard movement tracks physical key releases independently of simulation resets. Direction and run survive stage changes and chapter handoffs, while keyup, focus loss and hidden pages clear the corresponding holds. Delícia uses the same movement state.
- The catalog announces fullscreen ownership to supported games. Only the catalog entry button is visible outside fullscreen; the game supplies the exit button inside fullscreen. Standalone games retain their entry/exit button. The catalog continues sending the previous state message for immutable older builds.
- Repeated fullscreen clicks are ignored while the native request is pending. The button icon and accessible name follow entry/exit state, and focus returns to a visible gameplay canvas.

Publication still uses only production builds; no automated tests, typecheck, browser review or hardware validation are part of this update.
