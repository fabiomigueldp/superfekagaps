# Reserva Gelada — frozen base island

The authored industrial cold store follows campaign M5: blue ice, pale insulated metal,
purple reserve vessels, a circular gasketed cold-room door and warm lamps. The source
uses the released camera family, a complete 1920×1200 frame and ortho scale20.6.
Atlas placement is fixed at origin(2.7,−1.8), scale1; earlier islands are unchanged.

## Circulation and boundaries

- Five generous landings follow an open right-to-left inspection route. Supported
  metal ramps and bedrock-rooted piers connect every authored elevation
- The5-3→5-5 shipping shortcut is a freight corridor with its viewing wall and roof
  cut away. Rear ribs, a roof remnant and barrel rails preserve the tunnel's identity
  while keeping the original Feka visible
- Frozen5-1 is world(5.4,−2.6,1.35), local(.664306,.776122), radius.82. Its retained
  approach is5-1→(5.4,−1.5,1.35)→(6.35,−1.5,1.35)
- The additive Serra–Reserva source owns the passenger terminals, doors, carriers,
  cableways and shared-link audit. The provisional large terminal slab was removed
- The heated west dock remains a reserved boundary. No world6 route or new ice or
  thermal physics is included

## Reproduce from source

Requires Blender4.x, Node and Python with Pillow. No cached .blend or earlier render
is an input; intermediate scenes and proofs stay outside the repository.

```sh
blender -b -t 8 -P tools/diorama/check_reserva_map.py -- --output-dir /tmp/reserva-audit
blender -b -t 8 -P tools/diorama/render_reserva_map.py -- --final --static --output-dir /tmp/reserva-final
python tools/diorama/package_reserva_map.py --input-dir /tmp/reserva-final --audit /tmp/reserva-audit/reserva-validation.json --output-dir public/assets/world/map --docs-dir docs/world/diorama
```

The packager requires a passing final audit and matching builder/metadata hashes.
It rejects an empty, clipped or non-native frame, measures actual alpha bounds and
checks the decoded WebP dimensions and alpha bounds. The background includes no
Feka or passenger-carrier pixels.

## Verification and timing

The final frozen source passes327 positions at≤.10 world-unit intervals:981
footprint rays, upright headroom, closed-solid body containment and120 rooted route
piers.575,520 rays test every opaque source-pixel square center and four inset
corners across idle plus six walk frames and both facings.566,930 further rays
test the real rounded/ceil CSS raster in desktop, portrait and landscape profiles.
All body, head and face foreground-contact counts are zero. Contacts within the
bottom two source pixels are retained in the validation report as floor-level
contacts, including fractional raster overlap.

Physical3D route lengths use the released walking pace of1.73 world units/s:
main edges1.857203,2.431564,2.663976 and4.319177 seconds; shipping shortcut4.705948
seconds. The retained station approach duration is exported separately. No route
is sped up to compensate for its geometry.

These authoring gates cover the base island only. Browser walkthroughs, final
camera/HUD fitting, the additive passenger connection and old-maintenance
preservation remain separate integration gates. See[reserva-validation.json](reserva-validation.json)
for exact scope and[reserva-art-manifest.json](reserva-art-manifest.json) for bounds,
source hash and payload hashes/bytes.
