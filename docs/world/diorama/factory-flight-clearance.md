# Factory flight clearance

The Factory–Guaíra flight now lifts before the small boarding shelter rather
than carrying its wing and landing gear through the roof, posts and destination
board. The original contact was reproduced on main `5ac1a8c` at departure
2.1667 seconds using the shipped camera, aircraft frame and source meshes.

## Narrow change

- Existing Factory foundation supports a 1.3 m roll from `(0.9, -2.94, 1.07)`
  to `(2.2, -2.94, 1.07)`. The 4 cm southern inset clears the raised inspection
  walkway; the stop avoids the raised landing pad.
- A 0.6 second runway-aligned climb/approach joins the airborne curve smoothly.
- Aircraft size, 7.4 second trip, 1.15 second reduced-motion transfer, physical
  strip, passenger anchors, scene geometry and image assets are unchanged.
- Only the two Factory middle bends change. Guaíra's approved terminal corridor
  and both complete Serra routes are preserved.

## Focused verification

Frozen runtime pose SHA-256:
`3aa2273d4c42954999fe9cc98362af69d25d553400426f20a5fe4ad364bdd590`.

Independent Factory source review covered both complete flights at 60 Hz:
890 poses, 999 obstacle meshes and 51 aircraft parts including conservative
runtime propeller/flap envelopes. No surface collision, closed-solid containment
or unresolved 5 cm separation pair remained. All 615 authored wheel contacts
hit the existing foundation. Raised paving, inspection walkways, shelter and
coastal coping remained obstacles; actual terrain and explicitly identified
ground-color wash, sub-centimeter seams and small decorative ground aggregate
layers were treated as ground.

All 565 changed pose records also clear the visible Guaíra scene. The 890 Serra
route records are byte-identical. Of 326 Guaíra endpoint records, 325 are exact;
one join differs only by `5.6e-17` in speed and approximately `2.3e-31` in bank.
All position, heading, frame and scale fields remain exact there.

Peak heading changes are below 3.65° per 60 Hz frame, versus 3.81° before.
Peak speeds are 2.0974/2.0365 atlas-metric units/s, below 2.2412/2.0993 before;
peak vector acceleration is below 2.947/2.819 rather than 5.296/4.909.
The plane is not accelerated to skip scenery.

45 focused aircraft/flight tests, 5 campaign-art tests, both TypeScript projects,
a direct Vite build
and Blender metadata regeneration passed. Native Canvas frames use the actual
runtime camera, scene painters and aircraft renderer. The frozen Factory scene
and regenerated source have matching object geometry; image assets were not
rerendered.

## Scope

This is sampled source clearance in the calibrated authored billboard embedding,
not a physics engine or continuous swept-path guarantee. The host paints only
source and destination scenes during a flight. It does not establish browser,
device, performance or deployment coverage, nor an all-airport certification.
