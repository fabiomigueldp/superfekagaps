# Guaíra campaign region and grounded STOL terminals

Original Blender geometry. The campaign diorama deliberately reuses the actual
crafted Guaíra neighborhood, rice fields, reservoir and Casa da Vazão, not a new
generic tropical island. Clean cyan irrigation water and the separate violet
clandestine tank remain visually distinct. No chapter assets or numeric campaign
IDs are modified.

## Integration

`src/adventure/GuairaCampaignArt.ts` exports:

- `GUAIRA_CAMPAIGN_ART[region]`: image path, image frame, placement, terminal and
  aircraft projection scale. Keys: `fabrica`, `guaira`, `serra`.
- `campaignArtOverlay(region, image, atlas = true)`: compatible with the existing
  connection overlay painter. Paint Fábrica and Serra terminal extensions over
  their existing island image; the Guaíra image is the complete region.
- `campaignArtBounds(region, atlas = true)`: include these in focus/overview bounds.
- `campaignAirportTerminal(region, atlas = false)`: ground-contact parking anchor,
  runway endpoints, continuous boarding approach and physical clearance.
- `paintCampaignRegion` and `loadCampaignRegionImage`: optional, lazy, failure-safe
  independent art rendering. No runtime/progress mutations.
- `GUAIRA_CAMPAIGN_NODES/ROUTES`: exact new camera projections of the existing
  five chapter landmarks; these do not create new numeric world/stage IDs.

The airport is on land: wheels, runway dust and dry taxi motion. Do not reuse ferry
wake/water effects. Guaíra's full frame is 27 world units; multiply the aircraft
20.6-reference scale by `aircraftScale = 20.6 / 27` when drawing locally there.
Factory and Serra preserve their original 20.6-reference cameras exactly.

Guaíra placement: origin `(3.65, .05)`, scale `1.1`. Existing six atlas placements
remain unchanged. Region selection and campaign gates belong to the integrator.

## Physical contract

All three airstrips have a closed, ground-supported retaining embankment, dry
runway, open terminal canopy, office, waiting bench, cargo and windsock. Clear
span is 5.2 m; usable runway length is 7.3 m. Buildings are outside that clear
corridor. Physical support and approach waypoints are recorded in each metadata
file. The Fábrica approach begins at `3-4`; Serra at `4-1`; Guaíra at `guaira-1`.
Stage-to-terminal travel from `3-5` must first follow the existing path to `3-4`.
The module's anchor is the aircraft ground center; passenger attachment offsets
come from the aircraft sprite's own metadata.

The new apron/walkway strips are closed solids down to the same bedrock datum.
Overlapping top faces have staggered 4 mm lifts to avoid coplanar render artifacts.
The runway surface is separated from the embankment top by its actual thickness.

## Reproduce

From the repository root, for each region:

    blender -b -t 8 -P tools/diorama/guaira_campaign/build.py -- --region guaira
    blender -b -t 8 -P tools/diorama/guaira_campaign/build.py -- --region fabrica
    blender -b -t 8 -P tools/diorama/guaira_campaign/build.py -- --region serra
    python tools/diorama/guaira_campaign/package.py

Cycles CPU, 32 samples, no denoising, 1920×1200 RGBA master. Packaging writes WebP
91 and crops only the two standalone terminal layers with two-pixel filter gutters.
Cropping preserves each original projection through its explicit image frame.
Raw PNG and temporary Blender caches are reproduction artifacts, not runtime assets.

## Focused validation

- 42 support ray casts per terminal, all passed; tests also check parking/runway
  endpoints lie within their closed physical support footprints.
- Four focused tests passed: support/asset budget; unchanged numeric placements
  and exact projected attachments; renderer/overlay contract at desktop/compact.
- New pure TypeScript module passes isolated compiler check.
- Three WebP files total 187,474 bytes, lazy loaded.
- `render-desktop.jpg` and `render-compact.jpg` are inspected Blender artwork
  composites at 960×600 and 390×640. They are render proof, not browser screenshots.
  Local Chromium screenshot startup was blocked by the executor's socket policy;
  cloud Browser also rejected its localhost URL. Integrated UI/browser verification
  remains the campaign integrator's responsibility.

No full suite, main merge, Oracle access or Vercel deployment was performed.

## Airfield readability polish

The same three terminals now have graded shoulders, thin ivory landing-lane
edges and more legible threshold bars. Roof seams, an ivory canopy fascia and
one small gold boarding-arrow plate relate the terminals to the handcrafted
neighborhood. Subtle procedural soil/stone grain and sun-faded color variation
break up the previously featureless retaining faces. No new gameplay objects,
landmarks, textures, routes, physics or progression state were introduced.

The original and updated 960×600 Blender composites were inspected, along with
the 390×640 compact composite and both isolated terminal layers. These are actual
Cycles artwork renders, not integrated game/browser screenshots. All camera,
terminal (parking, runway endpoints and boarding path), support, landmark and
route metadata compare exactly to the preceding release. Serra’s transparent
crop extends upward by one master pixel for the raised roof edge; its explicit
frame compensates exactly, so there is no shift or scale change. All 126 support
raycasts passed in generation, and all four focused campaign-art tests passed
after packaging. Transfer cost is 11,090 bytes above the preceding artwork.
