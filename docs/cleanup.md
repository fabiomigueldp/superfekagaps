# Local generated files

`output/` contains disposable review captures, recordings and intermediate renders.
These files are not production assets and must remain ignored by Git. References
to them in historical review reports describe captures made at the time; those
captures may have been removed during cleanup. Previously tracked Turbosuco
captures remain available in Git history.

Production assets live in `public/`; editable sources and authoring tools live in
`docs/`, `audio-pilots/` and `tools/`. Preserve these sources, installed dependencies,
tests and the Git history when cleaning local generated files.

When no build, render or publication is running, local `dist/`, `.cache/`, Python
`__pycache__/` directories and Blender `.blend1` backups with an existing `.blend`
source can be removed. Old `.tmp/release-*` publisher copies, temporary scripts and
review results can also be removed; use the current deployment workflow instead.

Keep `.tmp/deploy/source/`, `source.json`, `last.json` and the log directory named
by `last.json` for efficient incremental publication and its latest audit record.
Older deployment log directories can be removed. See [deployment](deploy.md).

## Historical review media

The November 2026 storage cleanup removed tracked MP4/WebM review recordings
under `docs/` and the derived `imperio-delicia-v2.glb`, `-v3.glb` and `-v4.glb`
exports. These outputs are now ignored. Their matching editable Blender scenes,
render/image masters, screenshots, reports and production assets are retained.
The original `imperio-delicia.glb` remains part of the authored asset contract.

Historical review pages and reports can still refer to removed recordings or
exports. To inspect the exact historical artifact, restore a selected file from
commit `b1fc3a4` with `git restore --source=b1fc3a4 --worktree -- <path>`.
Keep regenerated recordings in `output/`. Blender exports can be produced again
from the corresponding preserved `.blend` scene using Blender's glTF exporter.
