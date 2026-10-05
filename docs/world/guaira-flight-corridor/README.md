# Guaíra runway and low-altitude corridor

## Scope

The corrected flight uses the existing rural meadow, physical aircraft scale and village. Only two campaign cactus clusters that intersected the wing envelope are suppressed. No terrain is enlarged, no building moves, and chapter art remains unchanged.

The physical runway remains 4.65m long, with its original endpoints, boarding anchor and boarding path. New separate `rollStart` and `rollEnd` contacts run along x = −6.85, from y = −2.1 to y = 0.1, at z = 1.8. The earlier lift/touchdown point allows a gentler straight climb/final approach before the aircraft reaches the village roofs.

## Opposite-terminal preservation

The reviewed follow-up keeps the original Fábrica/Serra flight poses exactly through 3.1s on departure and from 5.1s on arrival, including their original pitch and bank. This removes the added roof-seam, fir-branch and coastal-frond contacts introduced by the first corridor version. Existing opposite-airport scenery contacts and the inherited lift pitch discontinuity remain outside this correction.

Only the mid-flight path is blended: 3.1–4.1s toward Guaíra, or 4.1–5.1s from Guaíra. The quintic weight has zero first and second derivatives at both ends, and ground velocity includes the derivative of the blend weight. All 652 opposite-end 60Hz poses match the actual pre-correction baseline, and all 652 Guaíra endpoint poses match the approved corridor. The 41 dense closest-roof samples remain byte-identical.

### Known remaining Serra overlap

Serra still has conspicuous inherited aircraft overlap with elevated trail posts, cliff surfaces and vegetation, including the reviewed departure interval around 3.12–3.32s and arrival interval around 5.03–5.08s. The same aircraft/prop contact pairs occur in the original baseline; the blend can change their timing. This remains a separate Serra terminal correction. This package does not certify all airports as clear.

## Motion contract

- Travel duration: 7.4s; reduced motion: 1.15s, unchanged.
- Ground phases and host save/cancel/skip/return/input semantics are unchanged.
- Guaíra departure aligns straight from 2.1–3.1s; arrival aligns straight from 5.1–6.1s. Bank is zero within those corridors.
- Runway velocity eases from 1× to 2× during the outbound corridor, reversed on approach. The integral is `d * (u + u³ − 0.5u⁴)`, so endpoint acceleration is zero.
- Central degree-seven Bézier controls match position, velocity and zero acceleration at the straight joins. Two authored high-altitude handles give a broad bend rather than a slow pivot.
- Altitude uses smoothstep over the aligned second, retaining the same 0.24 maximum. Altitude is C1, not C2; its endpoint acceleration changes. Peak vertical speed is 0.36 map units/s.
- Actual 60Hz heading changes stay below 3.81° per frame; central airspeed stays above 0.25 map units/s across the four routes.
- Plane frame atlas, physical scale, opposite terminals and world placement are unchanged.

## Native proof

[Four full sequences, normal speed](four-routes-full-speed.mp4) · [The same sequences at quarter speed](four-routes-4x-slow.mp4)

[Departure to Serra](guaira-serra-sheet.jpg) · [Departure to Fábrica](guaira-fabrica-sheet.jpg) · [Arrival from Serra](serra-guaira-sheet.jpg) · [Arrival from Fábrica](fabrica-guaira-sheet.jpg)

The four sequences each contain 445 actual runtime poses, camera samples and painter outputs, from 0 through 7.4s at 60Hz. They were rendered at 960×540 and 390×640. Contact sheets and representative full frames were inspected; the MP4s provide full-speed and slowed playback artifacts. Generating these files is not a claim that their playback was watched in a browser or on a device, or that performance was tested. No browser retry was attempted. The revised native art is the coordinator’s combined tree recorded in the manifest; the flight-only follow-up does not modify those regional assets.

The geometric proof reconstructs the actual selected 32-frame aircraft sprite, changing scale, bank, pitch, altitude and suspension in the campaign camera's authored source embedding. The original corridor audit checked 1,780 poses against 1,738 Guaíra props: no body intersections and at least 5cm conservative sampled surface clearance. The follow-up reuses that evidence only for identical poses and checks the changed mid-flight samples separately. [The revised clearance summary](clearance-summary-v4.json) partitions all 1,780 Guaíra samples and records the bounded inherited Serra findings. All 1,230 tested authored Guaíra wheel contacts are supported. Conservative full propeller-disc and flap-deflection envelopes also pass the 5cm sampled-pose bound.

The original nearest identified wingtip/house-roof witness was also checked at 600Hz over 5.95–6.016667s: 41 samples, no intersections, minimum exact sampled distance 0.107494m at 5.988333s. The selected sprite remained frame 24 throughout. See [the local refinement](local-dense-clearance.json).

These are bounded source-geometry checks, not gameplay collision physics. Orthographic art does not uniquely determine hidden depth. Explicit ground/surface/water exclusions and time-sampling limits are recorded in the audit summary. Shadows, dust and decorative wisps are cosmetic.

Campaign earned-water art was regenerated against the changed campaign scene. Its alpha mask and all eight motion crops are identical; scratch area remains 2,266 pixels. One visible RGB pixel differs by at most 3/255. No removed cactus returns when the saved water state changes.

## Checks

- The original corridor implementation passed 1,794 TypeScript tests and 3 JavaScript tests; that broad suite was not rerun for this narrow follow-up.
- The follow-up passed 42 focused route, camera, motion-preference, lifecycle, metadata and renderer tests, including exact baseline preservation, malformed contacts and C2 joins.
- Both TypeScript projects passed again after the follow-up. Original corridor level/player/world validators, production build and size gate passed; combined integration owns the final build check.
- Original corridor production build: 43,567,564 / 45,000,000 bytes.
- The npm `tsx` CLI wrapper hit its local IPC restriction. The same test/validation scripts ran successfully with `node --import tsx`; this did not involve a browser or network workaround.
- Revised full-route pose SHA-256: `777b1552d412c3043d75b7a061c1458559ecbeb9bdd1bda3955864cbd5f45014`. The earlier 1,780-pose audit and its provenance are retained separately; see the revised verification manifest for exact equality and changed-window coverage.

## Reproduction

From the repository root, with the existing dependencies and a native Canvas installation:

```sh
WATER_CANVAS_MODULE=/path/to/@napi-rs/canvas node --import tsx tools/guaira/prove_guaira_aircraft_clearance.mts /tmp/guaira-flight-proof "$PWD"
PROOF_WIDTH=390 PROOF_HEIGHT=640 WATER_CANVAS_MODULE=/path/to/@napi-rs/canvas node --import tsx tools/guaira/prove_guaira_aircraft_clearance.mts /tmp/guaira-flight-compact "$PWD"
```

Regenerate campaign-only source/art and its earned-water layer through the existing `tools/diorama/guaira_campaign/build.py`, `package.py`, `build_restored_water.py` and `package_restored_water.py` workflows. Do not regenerate chapter art for this correction.

```sh
blender -b -t 4 -P tools/diorama/guaira_campaign/build.py -- --region guaira --output-dir /tmp/guaira-flight-campaign --samples 32
blender -b -t 2 -P tools/diorama/render_journey_aircraft.py -- --output-dir /tmp/guaira-flight-aircraft --metadata-only
```

The native proof writes `poses.json` and retains every full pose and selected frame in its detailed report, plus source/art input hashes. The geometry helper consumes those records and the regenerated source scenes. See the audit summary for the exact final parameters and limitations.


```sh
blender -b /tmp/guaira-flight-campaign/guaira-campaign.blend -t 2 -P tools/guaira/audit_aircraft_corridor.py -- --poses /tmp/guaira-flight-proof/poses.json --aircraft /tmp/guaira-flight-aircraft/journey-aircraft.blend --output /tmp/guaira-flight-audit.json --candidate-label "reviewed aligned corridor"
```

The helper requires Blender's bundled NumPy. Its explicit Guaíra projection defaults are ground z=1.8, atlas origin=(3.65, 0.05), atlas scale=1.1; do not reuse these for another airport. Default coverage includes source meshes plus the full runtime propeller/flap articulation envelopes. Reports snapshot input hashes and enumerate every excluded surface. [Compact audit results](audit-summary.json) and [validation/input hashes](verification.json) record the reviewed result.
