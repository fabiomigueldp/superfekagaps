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
