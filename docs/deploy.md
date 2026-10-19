# Fast Oracle deployment

```sh
npm run deploy
npm run deploy -- -m "Describe the changes"
```

One command adds pending files, commits when needed, pushes `main`, builds the
committed source and updates all existing World experiences on Oracle. It never
runs tests, typecheck, validation scripts, browser reviews, `npm ci`, or the npm
`prebuild` hook. Only Vite and its existing packaging policy run.

The build and push run concurrently. The build snapshot excludes documentation,
tests and authoring tools, and reuses the installed `node_modules`. New edits made
while deployment runs stay outside the published commit. A failed build or push
stops publication; there are no forced pushes or automatic branch switches.

The publisher compares SHA-256 content hashes and sends only missing files in a
compressed stream. On first use, it seeds its cache from the already installed
game, so unchanged music, images and video need no upload. No rsync installation
or additional npm dependencies are required on Windows.

- Local entry: `scripts/deploy.mjs`; logs and latest result: `.tmp/deploy/`.
- Remote helper source: `scripts/deploy/oracle.mjs`.
- Remote runtime, content cache and history:
  `/home/ubuntu/.cache/superfekagaps-deploy/`.
- Existing release store: `/home/ubuntu/torbware-world/`.

The helper updates itself over SSH and reuses Torbware's publisher and installed
module lexer. Its private operator adapter records **build succeeded / tests not
run** truthfully. It does not modify Torbware's source checkout or rebuild/restart
services. Package checksums, storage isolation, the catalog lock, atomic activation,
the previous catalog and existing release retention remain in use. Large temporary
build copies are removed after publication; cache and small history records remain.

Prerequisites: installed project dependencies, Node.js 20+, Git, tar, and the
existing `oracle` SSH alias with noninteractive access and `sudo -n` on Oracle.
Run from `main`. Use `--no-commit` to require an already clean checkout.
