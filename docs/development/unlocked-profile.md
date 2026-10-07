# Automatic development-stage access

The site is currently a development playground. Its ordinary entries automatically
load a separate testing profile with every valid stage available. There are no new
buttons, banners, screens, URL parameters, or interactions to activate it.

## Build switch and reversal

`VITE_DEVELOPMENT_UNLOCKED_SAVE` is a compile-time Vite option, defaulting to `true`
for the current development period. It applies to both `vite` and packaged builds,
including Vercel and the static package published on Oracle. Set it to `false` and
rebuild/redeploy to restore normal campaign progression:

```sh
VITE_DEVELOPMENT_UNLOCKED_SAVE=false npm run build
```

The deployment environment takes precedence over `.env` values. Only the literal
`true` enables it. Changing an environment variable after building does not change
an already-generated static bundle. A normal release should explicitly set it to
`false`. Browser reload then uses the untouched normal profile; re-enabling the
flag returns to the prior separate testing profile.

## Entry points and scope

- `/` and `/index.html`: all 30 World stages, Guaíra entry and the onward Serra
  connection are available using the existing map and travel controls.
- `/guaira-capitulo.html`, with or without `?campaign=1`: every stage in the chosen
  five-scene route is available through the existing journey list, including the
  bull and mayor encounters. Both existing opening choices still work. Optional
  Gallery/Relief excursions were already available.
- `/delicia.html` and `/?delicia=true`: all 12 main stages and both optional
  sanctuaries are available through the existing map/list.
- Standalone Guaíra/juice experiments, their direct HTML entries and the Extras
  hub already provide direct access. Their ephemeral World runtimes and the
  World editor do **not** adopt or write this testing profile.
- Classic (`?classic=true`) has no saved stage-unlock interface or campaign map;
  its original sequential run and high-score storage are unchanged. Editors also
  keep their existing direct level selection.

This is access, not completion. The overlay never synthesizes completed levels,
secret exits, seals, times, medals, lore, tutorial flags, salon visits, salon
victories, Guaíra water-release receipts, optional rewards, or legacy access.
Native bosses, stage objectives and the required salon encounter remain playable
and must be completed normally. Real test-run results persist only in the testing
profile. All existing input, travel-arrival and stale-callback checks remain.

## Storage guarantees

The exact normal storage keys remain:

- `super_feka_gaps_world_v1`
- `super_feka_delicia_v1`

Development appends `:development-unlocked-v1` to the corresponding key. If no
matching development profile exists, its first read copies the parsed normal
profile into memory. Reading does not write anything. The first ordinary save or
explicit import writes only the development key. Original saved bytes, including
formatting and unknown fields, are never replaced by development activity. World
and chapter share the World development namespace; Delícia remains separate.
Cross-campaign imports still reject before writing.

The access privilege is a process-local WeakSet marker, not a save field. Each
load, successful import and chapter reread restores that marker. JSON export does
not contain it. Importing a development export into a normal build retains only
ordinary schema-compatible earned data, not universal access. Specifically,
Guaíra's normal contiguous-route sanitizer discards out-of-order development
receipts; the separate development profile retains genuinely earned out-of-order
receipts through merges and reloads without inserting missing victories.

Malformed saved data remains protected from automatic writes. Explicit valid
import repairs only the active development slot. Denied or full storage leaves
all stages accessible in memory while retaining the existing storage warning;
no fallback ever writes to the normal key. Disabling the flag restores that
normal profile even if the development slot is corrupt.

## Focused checks

`tests/development-progress.test.ts` covers fresh and existing saves, exact-byte
preservation, all 44 World/Delícia stage gates, map prerequisites, no fabricated
results or privileges in exports, successful/failed/cross-campaign imports,
malformed normal/development slots, quota/denied/unavailable storage, reload,
flag-off/re-enable, chapter/World merge isolation, actual out-of-order chapter
receipts and Vite activation/reversal. Existing chapter host/map suites cover
free selection and restart without completion or additional controls. Aggregate
publication validation remains the final combined-release gate.
