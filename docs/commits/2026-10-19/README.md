# Recent commit technical records — 19 October 2026

The [follow-up review](../2026-10-19-followup/README.md) documents the next ten commits, through `fed12cf`, with exact-revision code maps and additional timing, persistence and authoring details.

This review covers all 23 commits reachable from `9c4c6bd` after `8c56886`, including the three incoming Classic commits and their merge. Earlier Vanguard work is documented in [its release notes](../../world/hipotetico/vanguard-refinement-2026-10-19/release-notes.md).

Each record describes its own first-parent patch, key symbols, runtime behavior, authoring outputs and known limits. Full hashes and immutable source links prevent later local edits from changing the meaning of a record. Documentation-only commits are identified as such. The original published commits are not amended or rebased.

| Record | Original subject | Changed paths |
| --- | --- | ---: |
| [`c559543`](c559543.md) | Fix Classic scoreboard dialog focus and keyboard access | 3 |
| [`f3488a2`](f3488a2.md) | Respect reduced motion for Classic camera shake | 2 |
| [`0352fae`](0352fae.md) | Pause Classic play on focus and visibility interruptions | 2 |
| [`893228c`](893228c.md) | feat(hipotetico): add persistent rear-street aftermath activity | 5 |
| [`61b6bcf`](61b6bcf.md) | Merge remote-tracking branch 'origin/main' | 6 |
| [`cc28f3d`](cc28f3d.md) | feat(hipotetico): render aftermath scenes and refine background activity | 8 |
| [`675e808`](675e808.md) | Polish siege background choreography and document living streets | 29 |
| [`31b17ef`](31b17ef.md) | Refine siege district routes, cargo lift and environmental progression | 39 |
| [`daca7c0`](daca7c0.md) | Add continuous varied background performances and camera-aware choreography | 40 |
| [`c90a690`](c90a690.md) | Recompress mechanism atlas losslessly to publish continuous background activities | 3 |
| [`9703bb9`](9703bb9.md) | Refine background debris searches, physical props and activity orchestration | 43 |
| [`bac366d`](bac366d.md) | feat(hipotetico): add bastion tower destruction and launcher animation | 10 |
| [`c667ac3`](c667ac3.md) | Polish Bastion tower collapse, launcher continuity and cinematic direction | 18 |
| [`63f7e11`](63f7e11.md) | feat(hipotetico): simulate tower collapse and refine rocket effects | 9 |
| [`e818e24`](e818e24.md) | Refine rocket flight, staged tower impact and settling debris physics | 19 |
| [`0ece972`](0ece972.md) | Polish tower rocket exhaust, material fractures and physical impact effects | 22 |
| [`1571adc`](1571adc.md) | Open Bastiao activities with tower destruction and a persistent rubble discovery scene | 34 |
| [`2590a86`](2590a86.md) | Enrich Hypothetical background choreography and environmental reactions | 42 |
| [`e82c90f`](e82c90f.md) | Refine background material reactions and grounded debris effects | 32 |
| [`23cfee3`](23cfee3.md) | feat(hipotetico): plant dinosaur feet and propagate yard vibrations | 8 |
| [`791cc3a`](791cc3a.md) | Publish grounded background movement and environmental impact polish | 24 |
| [`7807bcb`](7807bcb.md) | feat(hipotetico): expand tower-search aftermath simulation and rendering | 3 |
| [`9c4c6bd`](9c4c6bd.md) | Enhance tower rubble petista capture with multi-piece dismemberment and gore physics | 58 |

## Git notes

The English technical summaries are also attached to these exact objects in `refs/notes/commits`. Notes supplement commit messages without changing commit IDs. The Markdown files are the ordinary GitHub-browsable copy; Git notes are not automatically fetched by a normal clone.

```sh
git fetch origin refs/notes/commits:refs/notes/commits
git log --show-notes=commits
git notes --ref=commits show 7807bcb
```

The fetch command intentionally fails rather than overwriting diverged local notes. Reconcile existing local notes separately if necessary.

## Evidence rules

- A successful Vite build does not establish passing tests, correct gameplay or successful browser review.
- Historical Classic test claims are quoted from their original commit bodies and are not presented as new results.
- A missing local publisher receipt does not imply an unpublished commit. A later published descendant may include it.
- Pose sheets, directed videos and JSON state studies are authoring evidence. They do not establish full gameplay or audio quality.
- The tower discovery originally dropped an intact sprite at `1571adc`; `791cc3a` prepared staged drawing, and `7807bcb` added simulated body fragments. The older tower README/video must be read at their recorded revision.
- Uncommitted working-tree changes are outside this review and its documentation commit.
