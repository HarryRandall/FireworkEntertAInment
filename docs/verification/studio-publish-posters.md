# Studio publication, posters and history verification

Date: 4 October 2026. Working checkout: `FireworkEntertAInment-ui`, branch
`rebuild/45-studio-publish-posters`. **Needs owner review.**

## Scope

Publish review lists all stored design changes since publication, advisory checks and
actual product/show dependencies. Ask for review freezes the exact draft and records
a review request. Publishing checks the exact saved document and its sampled particle
budget before changing the catalogue lifecycle. Browser rendering uploads four PNG
formats and stores their renderer version and actual encoded dimensions. Failures
retain publication and offer a retry.

The Posters page lists current published effect and composed-product versions missing
current-renderer formats. It renders a serial batch or one version, reports progress,
continues after failures and retains failed versions for retry. Effect publication
invalidates affected product posters because product compositions use current effects.

History reads every saved version newest first and compares it with the preceding
version. Preview changes the stage without touching authored history or autosave.
Restore retains the current draft as an immutable checkpoint, then creates a new
editable draft from the selected same-effect snapshot.

## Prerequisites added

- Private security-definer review submission and public wrapper: exact-snapshot check,
  active editor authority, frozen `in_review` status and an attributed `reviews` row.
- Private atomic restore and public wrapper: parent lock, stale/current pointer and
  document checks, same-effect target, retained checkpoint and a fresh numbered draft.
- Private finish RPC and public wrapper: review note and publication/submission happen
  under the same snapshot lock rather than overwriting a concurrent autosave.
- Explicit function grants/revokes, the matching declarative and foundations SQL,
  pgTAP assertions and regenerated application types.
- Dependent product-poster invalidation in the existing publication transaction.

## Decisions taken

- Poster sizes are visual choices in CSS pixels: card 320 × 200, wide 960 × 540,
  square 600 × 600 and OG 1200 × 630. The named references did not specify numeric
  sizes. PNG follows the existing `poster()` API. Actual dimensions, including the
  renderer's DPR, are decoded from the resulting image before recording metadata.
- Capture uses the renderer's developed moment and kind-specific default framing.
- Review requests are `comment` records attributed to the requesting editor, carrying
  the change note. Submitted documents stay read-only.
- A retained draft checkpoint uses `superseded`, with a retention note. An already
  published current document is already immutable history and is not duplicated.
- The maintenance queue targets current published versions, including products with
  compositions. Archived and historical versions are not bulk re-rendered.
- Completed Studio lifecycle operations reload the editor to establish the new version
  and autosave lifetime. Ordinary autosave preserves the mounted reducer and undo/redo.
- Existing Radix Modal, ActionMenu and ReUI Data Grid adaptations are reused. No new
  registry item or bespoke generic table/dialog was added. No lint exceptions were added.

## Commands and actual results

All Node commands used Node 24.18.0 first on PATH and pinned pnpm 12.3.4. No browser,
dev server, hosted database, commit, push or PR publication was run.

| Command                                                      | Result                                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                             | Passed                                                                                                                       |
| `pnpm format:check`                                          | Passed                                                                                                                       |
| `pnpm db:seeds --check`                                      | Passed                                                                                                                       |
| `pnpm db:validators --check`                                 | Passed                                                                                                                       |
| `pnpm db:duration-fixtures --check`                          | Passed                                                                                                                       |
| `pnpm lint`                                                  | Passed                                                                                                                       |
| `pnpm typecheck`                                             | Passed                                                                                                                       |
| `pnpm exec tsc -p tests/browser/tsconfig.json`               | Passed; browser tests were only type-checked                                                                                 |
| `pnpm test`                                                  | Passed, 93 web tests                                                                                                         |
| `pnpm build`                                                 | Passed, production Next.js build                                                                                             |
| `pnpm knip`                                                  | Passed, existing CSS configuration hint only                                                                                 |
| `pnpm test:lint-rules`                                       | Passed, 1 test                                                                                                               |
| `pnpm test:database-tooling`                                 | Passed, 15 tests                                                                                                             |
| `pnpm test:packages`                                         | Passed, fireworks 650, planner 17, video-fit 4 tests                                                                         |
| `pnpm test:workers`                                          | Passed, 19 tests and Ruff checks                                                                                             |
| `pnpm test:video`                                            | Passed, 21 tests and Ruff checks; optional matplotlib warning                                                                |
| `pnpm test:analyser`                                         | Failed, 55 tests, 11 errors and 2 skips                                                                                      |
| `pnpm test:analyser:contract`                                | Failed, 24 tests, 11 errors                                                                                                  |
| `pnpm db:documents`                                          | Regenerated the foundations baseline                                                                                         |
| `pnpm db:types`                                              | Regenerated types from this lane's local schema                                                                              |
| `pnpm db:setup`                                              | Passed local start/reset/seeding; also includes `pnpm db:reset`                                                              |
| `pnpm db:test`                                               | Retry passed, 41 suites and 2,640 assertions, concurrent job claim and 99 public template/six persona acceptance checks      |
| `pnpm db:lint`                                               | Passed, three existing `private.effect_facts` warnings only                                                                  |
| `pnpm db:types --check`                                      | Retry passed                                                                                                                 |
| `pnpm db:documents --check`                                  | Passed                                                                                                                       |
| `pnpm exec supabase db diff --local --schema public,private` | Passed; 884 grant statements, no structural/function drift. These grants are not an applyable migration                      |
| `git diff --check`                                           | Passed                                                                                                                       |
| `pnpm check`                                                 | Not invoked: it includes the forbidden browser runner. Its constituents were run individually; analyser gates remain failing |

An intermediate database run failed while the shared local Auth schema was being
reset, with missing Auth columns and type drift. No code was changed to accommodate
that state. Local setup and the database checks were rerun successfully.

The analyser failure is `RuntimeError: cannot cache function '__o_fold': no locator
available`, while importing librosa through the supplied virtual environment. Its
traceback resolves into another lane's environment. The original untracked virtual
environments were preserved and no follow-up inspection of that checkout was made.
The same import failure accounts for the contract gate's errors. Service code is
unchanged. Initial web type/lint/test failures were corrected; the final web checks
listed above pass.

## Evidence logs

Logs are local temporary artefacts, not CI or production evidence:

- `/tmp/studio-publish-lint-final.log`, `/tmp/studio-publish-types-final.log`
- `/tmp/studio-publish-browser-types-final.log`, `/tmp/studio-publish-web-test.log`
- `/tmp/studio-publish-build-final.log`, `/tmp/studio-publish-knip-final.log`
- `/tmp/studio-publish-format-final.log`, `/tmp/studio-publish-packages.log`
- `/tmp/studio-publish-workers.log`, `/tmp/studio-publish-video.log`
- `/tmp/studio-publish-analyser.log`, `/tmp/studio-publish-analyser-contract.log`
- `/tmp/studio-publish-db-setup-retry.log`, `/tmp/studio-publish-db-test-retry.log`
- `/tmp/studio-publish-db-lint-retry.log`, `/tmp/studio-publish-db-types-check-retry.log`
- `/tmp/studio-publish-db-documents-check-retry.log`
- `/tmp/studio-publish-db-diff-retry.sql`, `/tmp/studio-publish-db-diff-retry.log`

## Composer browser gate

`tests/browser/studio-publish.spec.ts` is type-checked but unexecuted. It signs in as
admin, duplicates an effect and covers review diff, publication, four persisted poster
rows, upload failure with retained publication, Studio retry, the maintenance queue,
review-row creation, history preview/back/restore and retained draft, layers, inspector
tabs, undo/redo, autosave and Saved after reload. It checks non-admin refusal, desktop
and 390 px, light/dark, axe and page overflow. Conditions use assertions and polling,
including hydration-sensitive click retries; no fixed sleeps are used.

No screenshots were produced. The composer-run suite writes attachments under
`output/playwright/`, including `publish-review-{desktop|phone}-{light|dark}.png`,
per-review-section images, history, preview, layers, each inspector tab, full Studio
and `poster-queue-{desktop|phone}-{light|dark}.png`. The composer also needs the
matching running prototype captures for comparison and the owner's visual review.
Browser/WebGL transport, accessibility and overflow assertions remain unverified until
that run. CI and production were not inspected or changed.
