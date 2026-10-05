# Serra supported offshore flight corridor

## Bounded correction

The plane now uses a short diagonal roll toward the open coast rather than the inherited path toward Serra’s elevated boardwalk. New separate roll contacts are (−1.6, −4.0, 0.6) and (0.1, −4.8, 0.6), a 1.879 m segment. The inherited runway endpoints and 4.34 m usable-length field are retained as compatibility metadata, along with the boarding anchor/path. That inherited strip is not newly certified as grounded. Terminal buildings, vegetation, bridges and aircraft size are unchanged.

The original nominal runway was not fully supported: the source terrain is sloping, with ground below its nominal z=0.6. A compact 3.960 m² core follows the exact two-direction three-wheel swept hull with a 0.12 m buffer; core plus irregular outer shoulder occupies 7.141 m². Its irregular tapered limestone shoulder is united into the existing mountain foot. There is no separate open surface, floating platform, painted runway or enlarged airport layout. The final foot is one closed polygon shell: 230 vertices and 127 polygons, with zero polygon boundary, non-manifold or inconsistent directed edges. All 615 authored three-wheel contacts sampled during both new ground phases at 60 Hz hit the support at z=0.6, with zero vertical gap. These checks certify the sampled contacts of the new 1.879 m roll, not the inherited runway extent or every point of the broader compatibility footprint.

## Motion and preservation

- Duration remains 7.4 s, or 1.15 s in reduced motion. Physical scale, host persistence, cancel/skip/replay and calm-transfer behavior are unchanged.
- Serra stays aligned for the first/last 0.6 s of airborne travel, using the existing 1× to 2× smooth speed easing. The exploratory higher speed factors were rejected and are absent from production.
- Serra height rises with `0.24 × smoothstep(seconds / 2)²`, reversed on arrival, so the plane builds offshore clearance before climbing. It meets the unchanged cruise height at the midpoint. Guaíra’s own one-second aligned corridor is preserved.
- Ground position/velocity/acceleration remain C2 at the straight/Bézier joins. Height is C1, not C2. The source lift pitch discontinuity is removed at Serra; unrelated Factory motion is preserved.
- Actual 60 Hz maximum heading change is 3.6997°/frame versus 3.8041° for the reviewed v4 baseline. Peak vector acceleration decreases from 1.7724 to 1.5894 atlas-metric units/s². Peak speed increases from 0.8914 to 1.0389 units/s; minimum central speed is 0.2694 units/s.
- All 890 Factory-pair poses match v4 exactly. Of the 326 relevant Guaíra terminal poses on the Serra pair, 325 are exact; at precisely 5.1 s only speed differs by 5.55×10⁻¹⁷ due floating-point evaluation immediately before the join. Ground position, altitude, heading, bank, selected frame and all other fields are exact. No hardcoded pose snapshot is used.

## Native before/after proof

- [Serra departure: full speed](serra-guaira-before-after.mp4) · [six-frame comparison](serra-guaira-before-after.jpg)
- [Serra arrival: full speed](guaira-serra-before-after.mp4) · [six-frame comparison](guaira-serra-before-after.jpg)

These compare the exact reviewed integration baseline `3505e59` against the final candidate, using actual motion, camera, aircraft frame selection, scale and scenery painters. Each leg has 445 native frames from 0 through 7.4 s at 60 Hz, at both 960×540 and 390×640. The native input hashes match the exact baseline tree; selected full frames and adjacent-frame comparison sheets were inspected. Videos are playback artifacts, not evidence of browser/device playback or performance testing. No browser retry or full-suite rerun was attempted.

The original overlap windows around Serra departure 3.12–3.32 s and arrival 5.03–5.08 s are explicitly present in the complete sequences. Plane/post silhouettes can still overlap in the authored perspective; their source depth and solid clearance must be interpreted together rather than declaring every 2D overlap a collision.

[Verification and motion metrics](verification.json) · [exact/toleranced preservation](preservation.json)

## Bounded source clearance

The independent final-source check covers all 890 Serra-pair poses against 3,916 props, including elevated walk decks, and 51 aircraft parts/runtime articulation envelopes. No sampled prop intersection or unresolved 0.05 m conservative margin remains. The 565 changed poses also clear the approved Guaíra and Factory source props.

All non-wheel aircraft parts remain above the final terrain, with a 0.0098048 m minimum global vertical bound. The billboard-reconstructed tyre/tailwheel meshes are not penetration-free: their maximum measured terrain intrusion is 0.0802385 m at arrival 6.2167 s, with contact also present in short takeoff/approach windows. This visual embedding is distinct from the authored three-wheel-center support model, whose 615 sampled gaps are zero.

Where a plane wing overlaps a distant pillar silhouette, source depth confirms foreground drawing. Ten witnesses provide 11,538 shared-camera rays, all with the aircraft in front; the minimum whole-object depth gap is 0.7555 authored units. This supports the actual painter order without pretending that 2D silhouette overlap disappeared everywhere.

The corrected polygon shell has consistent outward winding. Blender's n-gon tessellation retains one cancelling pair of opposite 1.86×10⁻⁷ m² triangles at the bottom coastal toe, unrelated to the visible support top or flight corridor. The diagnostic is retained explicitly; it is not hidden by a blanket zero-triangulation-defect claim.

[Clearance, depth and contact limits](clearance-summary.json)

## Focused checks

- 45 route/model/camera, motion-preference, lifecycle and campaign-art tests passed after the final asset regeneration.
- Both TypeScript projects passed.
- No full suite, browser/device, performance, deployment or server check is claimed. Final integration owns publication/build checks.

## Reproduction

From the repository root with Blender 4.3.2 and the existing native Canvas dependency:

```sh
blender -b -t 4 -P tools/diorama/guaira_campaign/build.py -- --region serra --output-dir /tmp/serra-flight-source --samples 32
python tools/diorama/guaira_campaign/package.py --region serra --input-dir /tmp/serra-flight-source
WATER_CANVAS_MODULE=/path/to/@napi-rs/canvas node --import tsx tools/guaira/prove_guaira_aircraft_clearance.mts /tmp/serra-flight-native "$PWD"
```

The general proof writes all four legs. This correction’s stored comparison clips focus on the two Serra legs; Factory pose equality is checked separately. Source geometry checks use the canonical same-camera authored billboard embedding and selected sprite frames. They are bounded source checks, not gameplay collision physics or a continuous swept-time guarantee.
