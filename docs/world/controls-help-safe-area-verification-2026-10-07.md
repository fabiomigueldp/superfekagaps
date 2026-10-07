# Controls help safe-area verification — 2026-10-07

The held change `320fdd0036fbb4cfeceb65112047eec0dafe5826` was merged cleanly onto main base `ea58835d8df1cbb22af0405569ded84c87de4ff8` for acceptance. Its shared CSS and four layout contract tests required no further corrections.

## Rendered acceptance

Chrome 154.0.8037.98 opened the real interfaces through their controls: main menu → options → controls, and Guaíra chapter map → Travessia da Vala Seca → attempt controls/help. The Vite app ran locally. Native Chromium viewport emulation and [CDP safe-area overrides](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setSafeAreaInsetsOverride) supplied actual CSS environment values; a computed-padding probe confirmed each inset before measurements.

Both interfaces passed all six cases below (12 rendered checks). Insets are CSS pixels in top/right/bottom/left order.

| Viewport | Insets | Result, both interfaces |
| --- | --- | --- |
| 1024 × 768 | 0/0/0/0 | Pass |
| 320 × 568 | 0/0/0/0 | Pass |
| 320 × 480 | 59/0/34/0 | Pass |
| 480 × 240 | 0/0/21/59 | Pass |
| 480 × 240 | 0/59/21/0 | Pass |
| 568 × 240 | 0/44/21/44 | Pass |

Measured dialog bounds stayed inside every safe edge with at least the configured 12-pixel minimum. Content retained positive height without horizontal overflow; the close button remained inside the dialog and at least 44 pixels tall. Native keyboard End scrolled overflowing content. Opening, scrolling and closing help left browser local storage unchanged. Screenshots confirmed the narrow portrait and asymmetric landscape layouts and the natural desktop layout.

Main help closed with Escape back to options. Chapter help closed with both its button and Escape, restoring focus to `chapter-controls`; closing with the button preserved the paused attempt and released canvas inertness. No browser page errors were reported.

These checks exercise Chromium layout with emulated viewport/insets, not physical-device Safari or Android acceptance. Screenshots, detailed measurements and execution logs are local ignored evidence under `.tmp/help-safe-area-20261007/`.

## Repository checks

- Focused help tests: 15 passed.
- `npm run check`: 2,217 passed, zero failures; two optional native pixel/crop checks skipped because `@napi-rs/canvas` is unavailable. Level, player asset and world validation, both TypeScript configurations, and production build passed.
- `npm run size:build`: 211 files, 51,039,126 bytes within the 53,000,000-byte limit (1,960,874 bytes spare).

The source/model tests remain explicitly separate from this rendered acceptance. The prior hold for unavailable browser evidence is resolved by the checks above.
