# Git progress and optimisation review

Date: 2026-08-03, Australia/Sydney  
Repository: `HarryRandall/FireworkEntertAInment`  
Workspace: `C:\Users\114514\Desktop\fire`  
Purpose: hand-off record for an independent model review

## Executive summary

The remote repository has not advanced since the analyser regression branch was
last inspected. Remote `main` is still `7a3290c`, and remote
`codex/analyser-regression-validation` is still `ce210db`. The current branch
contains five new local commits on top of `ce210db`, is six commits ahead of
`main`, and has a clean working tree.

All reviewed optimisation work is preserved in focused Conventional Commits.
The branch is ready to push and open as a Draft PR. The remote branch will not
contain these five commits until that push completes.

The implementation currently passes the available local automated gates, but
the local runtime differs from the newly pinned CI runtime. A CI run on the
committed branch is therefore still required before merge.

## Git snapshot

| Item                                  | Value                                      |
| ------------------------------------- | ------------------------------------------ |
| Current branch                        | `codex/analyser-regression-validation`     |
| Remote branch HEAD                    | `ce210dbf9abce559612d2439797df1737e883754` |
| Remote `main` HEAD                    | `7a3290c3503d19892806d991a003313a1bcb8081` |
| Divergence from `origin/main`         | 0 behind, 6 ahead                          |
| Divergence from remote branch         | 0 behind, 5 ahead                          |
| Working tree                          | Clean                                      |
| New local commits                     | 5                                          |
| Diff whitespace check                 | Pass                                       |

Remote HEAD values were verified with `git ls-remote` on 2026-08-03.

### Recent commits

1. `docs: add git progress review`, current local HEAD
2. `92a4752` - `fix(platform): restore cross-platform checks`
3. `c485e4a` - `ci(analyser): isolate real-audio regression`
4. `3b0ec24` - `test(analyser): stabilise audio regression`
5. `cdedf22` - `fix(analyser): harden response validation`
6. `ce210db` - `test(analyser): add real-audio regression validation`
7. `7a3290c` - merge PR #320

## Progress already committed at `ce210db`

The committed branch adds the first real-audio analyser regression baseline and
the schema 1.4.0 runtime validation boundary.

Main additions:

- Four CC BY Jamendo MP3 fixtures, totalling 18,584,984 bytes, approximately
  17.72 MiB.
- Versioned musical baselines and immutable fixture provenance.
- Python real-audio evaluator with JSON reporting.
- Zod validation before hosted analyser output is persisted.
- Node and Python regression tests.
- A CI step that runs the full real-audio evaluation.

Commit size: 16 files, 1,928 insertions and 5 deletions.

## Optimisations committed after `ce210db`

### 1. Analyser response boundary

Files:

- `platform/lib/bounded-response.ts`, new
- `platform/tests/bounded-response.test.mjs`, new
- `platform/lib/show-analysis-runner.server.ts`
- `platform/tests/analyser-output-validation.test.mjs`

Changes:

- Reads hosted analyser responses through a bounded stream instead of
  `response.text()`.
- Enforces an 8 MiB decoded response limit.
- Rejects oversized successful output as terminal 422 work.
- Preserves retry classification for oversized transient HTTP failures.
- Tests declared content length, streamed UTF-8 byte counting and runner
  integration.

### 2. Runtime schema and memory use

Files:

- `platform/lib/show-analysis-validation.ts`
- `platform/lib/show-analysis.types.ts`

Changes:

- Exposes `AnalyserV14Result` from `z.infer`, so newly validated output uses the
  exact runtime schema type.
- Adds missing legacy consumer fields such as cue `end`, raw metrics, blend
  weights and personality genre hint.
- Removes large temporary time-array concatenations during validation.
- Validates ordered fields and maximum times by iteration.

### 3. Real-audio comparison stability

Files:

- `platform/analyser/evaluate.py`
- `platform/analyser/tests/test_evaluation.py`

Changes:

- Replaces greedy unordered anchor matching with an ordered linear scan.
- Matches stored beat samples against the complete beat and downbeat grids,
  avoiding false failures when sample indexes shift slightly.
- Adds regression tests for ordering and full-grid candidate matching.

### 4. Reproducible analyser environment

Files:

- `platform/analyser/requirements.txt`
- `platform/docs/analyser-runner.md`

Changes:

- Pins the complete Python dependency resolution captured from the successful
  schema 1.4.0 GitHub Actions run.
- Documents that dependency and Python changes require real-audio review.

The recorded CI baseline environment was Python 3.11.15, NumPy 2.4.6, SciPy
1.17.1, scikit-learn 1.9.0, librosa 0.11.0, Pydantic 2.13.4 and SoundFile
0.14.0.

### 5. CI cost separation

Files:

- `.github/workflows/ci.yml`
- `.github/workflows/analyser-regression.yml`, new

Changes:

- Normal CI now runs on pull requests and pushes to `main` or `development`.
- The four-track regression has its own workflow.
- Real-audio evaluation runs on relevant analyser or fixture changes, weekly,
  or by manual dispatch.
- Evaluation artifacts are retained for 14 days.
- Python is pinned to 3.11.15 in Actions.

### 6. Existing quality-gate repairs

Files:

- `platform/app/actions/platform-admin.ts`
- `platform/app/components/app/FireworkReplayCanvas.tsx`
- `platform/lib/fireworks/import-renderer-contract.ts`
- `platform/tests/show-replay-preview-context.test.mjs`
- `platform/tests/user-profile-privileges.test.mjs`

Changes:

- Uses the generated Supabase `TablesUpdate<'users'>` contract for profile
  writes.
- Removes a React ref mutation during render and keeps only the pointer event
  snapshot required by the camera menu.
- Regenerates the import renderer evidence fingerprint.
- Makes source-based tests independent of Windows line endings and path
  separators.

## Validation record, 2026-08-03

| Check                     | Result                            |
| ------------------------- | --------------------------------- |
| Node test suite           | 577 passed, 0 failed              |
| ESLint                    | Passed                            |
| TypeScript `tsc --noEmit` | Passed                            |
| Python unit suite         | 18 passed, 0 failed               |
| Real-audio regression     | 4 passed, 0 failed                |
| Next.js production build  | Passed, 29 static pages generated |
| `git diff --check`        | Passed                            |

Local validation environment:

- Node 24.14.0
- Python 3.12.13
- SciPy 1.18.0
- Windows 11

Important limitation: CI is configured for Node 22, Python 3.11.15 and SciPy
1.17.1. The committed `ce210db` baseline passed under Python 3.11.15 and SciPy
1.17.1, while the new comparison and boundary commits passed locally under
Python 3.12.13 and SciPy 1.18.0. The final branch still needs one green GitHub
Actions run in the pinned environment.

The real-audio run emitted a Windows-only joblib warning because physical CPU
count detection could not invoke the expected system utility. Joblib fell back
to logical CPU count and all fixtures passed.

## Review findings and remaining optimisation opportunities

### P0: close the pinned-runtime validation gap

Push the preserved patch and require the Platform checks, Python analyser tests
and Real-audio baseline jobs to pass. Local success does not replace the Node
22 and Python 3.11.15 execution evidence.

### P1: Modal is not fully reproducible yet

`platform/analyser/modal_app.py` installs the pinned `requirements.txt`, then
runs a separate unpinned `.pip_install("fastapi[standard]")`. A future FastAPI
resolution can upgrade Pydantic or other shared dependencies after the lock is
installed. The Modal image also does not explicitly declare its Python minor
runtime.

Recommended follow-up:

- Pin FastAPI and its runtime dependencies, or install it under the same
  constraints file.
- Explicitly select the supported Modal Python 3.11 runtime.
- Rebuild Modal and rerun all four fixtures before deployment.

### P1: stored analyser JSON is still trusted on read

New hosted output is validated before persistence, but existing database reads
still use unchecked assertions in:

- `platform/lib/cue-generation/loaders.server.ts`
- `platform/lib/show-analyses.server.ts`

Recommended follow-up:

- Add an explicit schema-version dispatcher.
- Parse schema 1.4 rows with the runtime schema.
- Normalise supported 1.3 rows through a documented legacy adapter.
- Fail closed for unreadable analysis used by cue generation.

### P1: confirm the intended feature-branch CI policy

The new `ci.yml` no longer runs on every feature-branch push. Developers receive
CI only after opening a pull request, while `main` and `development` pushes
remain covered. This removes duplicate push and pull-request runs, but also
removes early feedback for branches without a PR.

The reviewer should confirm this trade-off with the team. If early branch
feedback is required, retain branch push checks and use a duplicate-suppression
strategy instead.

### P2: use a generated Python lock with hashes

The complete dependency resolution is currently maintained manually in
`requirements.txt`. Prefer a small direct-dependency input plus a generated,
hashed lock produced by `uv` or `pip-tools`. Dependency updates should regenerate
the lock and require baseline approval.

### P2: address repository binary growth

The four MP3 fixtures add 17.72 MiB permanently to normal Git history. If more
fixtures are planned, define a policy now:

- keep this small canonical set in Git and reject uncontrolled growth, or
- place future full tracks in Git LFS or a versioned release artifact with
  mandatory SHA-256 verification.

Do not replace full-song fixtures with short excerpts unless the section and
finale regression contract is redesigned.

### P2: fix Windows newline policy

This checkout has `core.autocrlf=true` and the repository has no
`.gitattributes`. Full Prettier checks therefore produce broad CRLF noise on
Windows even when Git reports a clean file.

Recommended follow-up: add an explicit `.gitattributes` policy and perform any
normalisation in its own reviewed commit. Do not mix mass newline changes into
the analyser patch.

### P3: reduce source-text test brittleness

Some integration tests assert implementation text with regular expressions.
The bounded reader itself has behavioural tests, but runner integration is
still partly source-based. Prefer dependency injection or an exported boundary
that can be tested through actual responses and error classifications.

### P3: silence the Windows joblib warning deliberately

For local evaluation only, set a task-specific `LOKY_MAX_CPU_COUNT` value or
document the harmless fallback. Do not hide other analyser warnings globally.

## Independent reviewer checklist

1. Run `git status --short --branch` before doing anything else.
2. Confirm the worktree is clean and compare the branch with `origin/main`.
3. Review the four implementation commits separately from this report commit.
4. Recalculate and verify the renderer fingerprint after any renderer edit.
5. Confirm the 8 MiB limit is comfortably above measured valid analyser output.
6. Test an oversized success response and oversized 5xx response end to end.
7. Verify legacy 1.3 analysis remains readable and 1.4 analysis fails closed
   when malformed.
8. Confirm the CI trigger policy and required branch-protection check names.
9. Run the full pinned GitHub Actions suite before merge.
10. Do not alter the upload-scoped analysis versus explicit Generate boundary.

## Suggested prompt for the next model

> Review `codex/analyser-regression-validation` in
> `C:\Users\114514\Desktop\fire` without rewriting or tidying unrelated history.
> Start with `git status`, compare the branch against `origin/main`, and read
> `platform/docs/git-progress-review-2026-08-03.md`. Validate the analyser
> response boundary, schema-version compatibility, ordered regression matching,
> Python lock reproducibility, CI trigger trade-offs, React camera-menu event
> semantics and renderer fingerprint. Report findings by severity with exact
> file and line references. Preserve the rule that upload may start music
> analysis quietly, but only the explicit final Generate action creates the show
> and starts cue generation.
