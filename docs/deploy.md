# Fast Oracle deployment — World

This workflow publishes the World experiences in Torbware's catalog, using
`/home/ubuntu/torbware-world/`. It does not update the separate Remaster/Classic
site directory, leaderboard API or SQLite database under
`/home/ubuntu/super-feka-gaps-remaster`, and does not restart that service.
See [Remaster/Classic hosting and leaderboard maintenance](scoreboard.md) for
that separate deployment target. Do not substitute its rsync/restart sequence
for this catalog publication workflow.

```sh
npm run deploy
npm run deploy -- -m "Describe the changes"
npm run deploy -- --message-file .tmp/deploy/release-message.txt
```

One command adds pending files, commits when needed, pushes `main`, builds the
committed source and updates all existing World experiences on Oracle. It never
runs tests, typecheck, validation scripts, browser reviews, `npm ci`, or the npm
`prebuild` hook. Only Vite and its existing packaging policy run.

The build and push run concurrently. The cached build snapshot excludes documentation,
tests and authoring tools, extracts only changes between commits, and reuses the
installed `node_modules`. Unchanged local assets are not copied again. New edits made
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
remote build copies are removed after publication; local/remote caches and small
history records remain.

Prerequisites: installed project dependencies, Node.js 20+, Git, tar, and the
existing `oracle` SSH alias with noninteractive access and `sudo -n` on Oracle.
Run from `main`. Use `--no-commit` to require an already clean checkout.

For a detailed commit, write the subject, blank line and technical body to a UTF-8
file and pass `--message-file`. This avoids transporting multiline messages through
PowerShell/npm command arguments. The tool passes the message to Git with `commit -F`.
Commit descriptions should identify behavior, implementation and validation that
actually occurred. Do not claim tests passed when only the Vite build ran.

After explicitly committing selected files, use
`npm run deploy -- --no-commit --allow-dirty` to publish committed `HEAD` while
leaving unrelated local edits untouched. This option requires `--no-commit`;
the cached snapshot still comes from the exact Git commit, never the working tree.

Recent commit descriptions and Git notes: [technical records](commits/2026-10-19/README.md).
