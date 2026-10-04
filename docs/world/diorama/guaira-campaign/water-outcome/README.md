# Earned campaign water

The campaign map previously displayed exactly the same Guaíra art before and after `guaira-prefeito`. The original art already has irrigated paddies; this change preserves them rather than falsely drying or redesigning the island.

The 2,252-byte transparent layer fills the existing public trough and adds five quiet highlights on existing irrigation channels. It is generated with the original camera and complete source geometry as holdouts, so rims, bridges and other foreground elements remain occluders. The original bitmap, routes and framing are unchanged. The source layer remains static. A restrained optional Canvas detail pass now adds slow reflections inside its existing alpha on the campaign atlas; reduced motion retains the original static layer exactly. The region dialog remains a static illustration.

Only the mayor completion receipt enables it. Old Serra access, optional Gallery/Relief rooms and Turbosuco completion cannot imply water restoration. The atlas and Guaíra region preview use the same asset. Missing optional art falls back to the original scene. The map render signature explicitly tracks water restoration, including when legacy access means the travel unlock state does not change.

`trough-and-channel-before-after.png` shows before on the left and earned outcome on the right, enlarged for review only. The runtime does not enlarge these details. `report.json` comes from the actual `paintWorldAtlas` renderer at desktop, narrow and short landscape sizes, with and without reduced motion. Only 323, 22 and 66 pixels respectively change, and the source save remains untouched.

Regenerate with `tools/diorama/guaira_campaign/build_restored_water.py` after generating the normal source scene. Run the renderer proof with `WATER_CANVAS_MODULE=/path/to/@napi-rs/canvas node --import tsx tools/guaira/render_campaign_water.mts`.

Focused validation: 10 tests in campaign consequences, campaign wayfinding and campaign art; app and tooling TypeScript checks. No broad test suite was run here. Turbosuco encounter assets/runtime, save schemas and progression were not changed. Its existing optional-victory journal record remains authoritative; no new map marker was invented without an existing salon anchor.


## Local water-motion prototype

`GuairaCampaignWaterMotion` adds two small drifting reflections to the restored public trough and a slow shade across the three visible channel glints. It uses four reusable alpha-masked crops (1,245 source pixels total, two-pixel transparent filtering gutters), without new assets or changes to the atlas painter, projection, camera, routes, progress, physics, chapter water, or flight code. The original asset's occluders still own every edge. No new water surface is inferred from already-irrigated paddies.

The normal atlas cadence supplies elapsed visible time. Live reduced-motion changes remove the extra pass immediately; no motion clock or frame loop is introduced. Unearned, reduced-motion and offscreen cases skip allocation/painting; missing optional Canvas contexts preserve the static reward. Surfaces are allocated lazily once and reused.

Render repeatable actual `paintWorldAtlas` before/after and native detail captures with:

```sh
WATER_CANVAS_MODULE=/path/to/@napi-rs/canvas node --import tsx tools/guaira/render_campaign_water_motion.mts /tmp/guaira-campaign-water-motion
```

The proof checks native 1920×1200, desktop 1280×800, narrow 390×540, and landscape 640×360 output. All changes stay inside the projected original water alpha; deterministic/reduced-motion/unearned pixel mismatches are zero. The effect changes 65 desktop pixels and four narrow-view pixels against the static frame. This is ambient micro-detail, not a larger celebration or progress cue. Native Canvas timings are diagnostic only and do not establish browser/device FPS. The fixture suppresses unrelated sea movement to isolate water differences.
