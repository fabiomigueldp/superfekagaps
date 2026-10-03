# Earned campaign water

The campaign map previously displayed exactly the same Guaíra art before and after `guaira-prefeito`. The original art already has irrigated paddies; this change preserves them rather than falsely drying or redesigning the island.

The 2,252-byte transparent layer fills the existing public trough and adds five quiet highlights on existing irrigation channels. It is generated with the original camera and complete source geometry as holdouts, so rims, bridges and other foreground elements remain occluders. The original bitmap, routes and framing are unchanged. The layer is deliberately static in both ordinary and reduced-motion rendering.

Only the mayor completion receipt enables it. Old Serra access, optional Gallery/Relief rooms and Turbosuco completion cannot imply water restoration. The atlas and Guaíra region preview use the same asset. Missing optional art falls back to the original scene. The map render signature explicitly tracks water restoration, including when legacy access means the travel unlock state does not change.

`trough-and-channel-before-after.png` shows before on the left and earned outcome on the right, enlarged for review only. The runtime does not enlarge these details. `report.json` comes from the actual `paintWorldAtlas` renderer at desktop, narrow and short landscape sizes, with and without reduced motion. Only 323, 22 and 66 pixels respectively change, and the source save remains untouched.

Regenerate with `tools/diorama/guaira_campaign/build_restored_water.py` after generating the normal source scene. Run the renderer proof with `WATER_CANVAS_MODULE=/path/to/@napi-rs/canvas node --import tsx tools/guaira/render_campaign_water.mts`.

Focused validation: 10 tests in campaign consequences, campaign wayfinding and campaign art; app and tooling TypeScript checks. No broad test suite was run here. Turbosuco encounter assets/runtime, save schemas and progression were not changed. Its existing optional-victory journal record remains authoritative; no new map marker was invented without an existing salon anchor.
