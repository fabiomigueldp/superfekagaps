# Rural airfield composition

The airport is subordinate to each existing destination. No numeric campaign IDs,
stage routes, chapter files, saves or gameplay code change in this art patch.

- Factory: compact dirt clearing directly on the existing coastal cargo ground.
  No additional terrain, perimeter foundation, office or airport platform.
- Guaíra: narrow matching-clay western shoulder merged into the village terrain.
  Original neighborhood, civic landmark, canals and five stage projections remain.
  Shoulder and lane sit below original paths to prevent coplanar black artifacts.
- Serra: original enriched mountain rebuilt with its existing continuous geological
  foot extended slightly south. No separate airport base or runway surface polygon.
  Original rock strata, station craft, foliage and cable art are preserved through
  the existing regional enrichment generator. Moving cabins remain separate.

Small open shelters (1.45 × 1.05 world units) replace full terminal buildings.
Aircraft scale is consistently 0.65 × 20.6 / source camera scale: .65 in Factory
and Serra, .5356 in Guaíra. The existing aircraft sprite/model is unchanged.

## Runtime contract

`GuairaCampaignArt.ts` is the source of projected boarding/parking/runway anchors,
asset frames and aircraft scale. Guaíra uses a 25-unit camera; Factory and Serra
retain the original 20.6-unit cameras. Guaíra stage projections come from that same
new camera. All atlas region placements remain unchanged.

Serra has `replacesBase: true` and a canonical 1920 × 1200 frame
`{left:0, top:0, widthInMap:1, heightInMap:1}`. Swap the old island image with this
asset; do not draw it on top of the old mountain or draw it again as an overlay.
Factory remains a cropped overlay. Guaíra remains a complete canonical scene.

Factory approach still starts at 3-4, Guaíra at guaira-1, Serra at 4-1. Serra has a
supported descent from the existing stair foot to the geological toe. The compact
runways are stylized STOL clearings, not real-world aviation engineering plans.

## Reproduction

    blender -b -t 6 -P tools/diorama/guaira_campaign/build.py -- --region fabrica
    blender -b -t 6 -P tools/diorama/guaira_campaign/build.py -- --region guaira
    blender -b -t 6 -P tools/diorama/guaira_campaign/build.py -- --region serra
    python tools/diorama/guaira_campaign/package.py

Cycles CPU, 32 samples, 1920 × 1200 transparent masters. Only Factory is cropped.
Raw PNGs and Blender caches are reproduction files, not shipped runtime assets.

The composition JPGs show full scenes at normal overview scale with the actual
32-heading aircraft atlas placed at metadata ground anchors. They are render
composites rather than screenshots of the complete interactive game. Runtime
arrival framing is verified separately by integration using the actual painter.
