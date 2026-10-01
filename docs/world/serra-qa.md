# Serra Suspensa: integration checks

This slice connects the authored Serra to the Factory and gives the discovered
4-3 → 4-5 shortcut two counterbalanced maintenance cabins. The camera and terrain
share the existing atlas coordinate system. Costa, Porto and Factory keep their
placements, routes, save IDs and ferry behavior. Worlds 5 and 6 retain their
existing selection fallback.

## Behavior

- Selecting a phase sets a destination. Entry becomes available only after Feka
  arrives. Intermediate islands and transport stations never become saved arrivals.
- The supported Factory–Serra passage opens with the existing 4-1 campaign gate.
  The closed state remains inspectable without granting access.
- Each maintenance car keeps its own physical lane. Riding either car moves its
  countercar to the opposite terminal. Boarding permissions change synchronously
  before another destination can be selected.
- Reversal follows the occupied lane. Skipping and reduced motion finish the same
  route and update both terminal positions. Returning to the map reconstructs one
  waiting car at each terminal without adding vehicle fields to the save format.
- The cabin passenger is painted between that car's rear and foreground layers.
  The complete cars retain the authored back-to-front order; the passenger is not
  moved above the other car to conceal an intersection.
- A missing cabin leaves the supported mountain paths available. A missing
  Factory–Serra link does not disable an already loaded local cabin, the ferry or
  the cargo bridge. Late image results activate at a confirmed arrival.
- The initial Costa visit does not load Serra. Its terrain, link, cabin and left
  Factory direction sign are loaded when the relevant region is inspected.

## Automated checks

The controller suite covers both cars, both occupancy phases, boarding and
disembarking thresholds, rapid destination changes, reversal, skip, reload,
reduced motion, undiscovered shortcuts, failed and delayed assets, and real
stage-entry gating. A complete Costa–Serra journey is sampled in both directions
at 320×568, 400×606, 590×378 and 740×320. It checks Feka and the occupied cabin
through each transition and checks that only the final arrival is reported.

That sweep caught a released camera-easing defect at the eastern Porto approach:
the moored ferry could fit while Feka was pushed beyond the opposite viewport
edge. The interpolation now fits the combined actor and vehicle extent before
translating the frame. All eight complete trip/layout combinations pass.

The six native transport controls and five phase controls retain their measured
target areas and separation on narrow, portrait and short layouts. The painter
tests verify that an incomplete cabin atlas is omitted and that the passenger is
painted once, inside the physically ordered occupied car.

## Release gate

On 2026-10-01, the implementation and final cabin exports passed 390 TypeScript
tests, 3 server tests, both TypeScript project checks, the level/player/world
validators and the production build. Live browser verification is still pending.
The added assets total 409,355 bytes and load on demand; their uncompressed RGBA
size is approximately 12.96 MB, before browser-specific storage or GPU overhead.
The JavaScript bundle is 144.17 KB gzip. These measurements do not claim physical touch coverage,
a browser-level reduced-motion preference check, or measured frame rate.

The synthetic browser fixture contains only artificial campaign progress. It is
kept outside the repository and may be imported only into the prepared preview
origin. Production progress is preserved. Oracle and deployment configuration are
outside this change.
