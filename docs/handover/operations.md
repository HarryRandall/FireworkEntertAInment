# Operations and troubleshooting

Start with the affected journey, environment, time and exact release. Use a
non-sensitive show, analysis or import ID to correlate logs. Do not paste API
keys, full signed media URLs, recovery links or public access tokens into issues.

## Where to look

| System         | Evidence to inspect                                            |
| -------------- | -------------------------------------------------------------- |
| Local web      | Terminal running `pnpm dev`, browser console and Network panel |
| Local database | Docker health, `pnpm db:status`, local Studio and test inbox   |
| Vercel         | Deployment build logs and runtime logs for the affected route  |
| Supabase       | Database/Auth/Storage logs, account state and project health   |
| Modal analyser | Image build, model download, dispatch and analysis call logs   |
| Modal importer | Dispatch call, run ID, worker failure and model/scoring output |
| GitHub Actions | Exact commit and failed CI/deployment job                      |
| OpenRouter     | Usage, balance, model availability and provider errors         |
| Upstash        | REST availability, usage/limits and configured database        |
| SMTP/domain    | Email delivery logs, verified sender and DNS/renewal state     |

## Local installation problems

| Symptom                             | Check and recovery                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nvm`, `node` or `pnpm` missing     | Reopen the configured shell, load nvm and run `nvm use`. Check Node 24 and pnpm 12.3.4. See Local setup for Corepack.                                                           |
| Frozen install fails                | Check you are at the root and on the accepted release with the correct pnpm. Do not regenerate the lockfile merely to bypass an install failure.                                |
| Docker connection/permission error  | Start Docker and run `docker info` in the same terminal. On Windows confirm Ubuntu WSL integration; on Linux follow Docker's user-access setup.                                 |
| Container download or startup fails | Check network/proxy, disk space and Docker resources. Inspect the failed container before retrying `pnpm db:start`. Do not remove unrelated containers or volumes.              |
| Local ports already in use          | Check the process using 3000 or 55421-55424. Stop only the known conflicting development instance. Keep configured Supabase ports aligned with the tooling.                     |
| `.env.local already exists`         | `db:env` deliberately refuses replacement. Privately compare its database values with `db:status`; update the existing file or securely move an obsolete local-only copy aside. |
| Empty catalogue/media errors        | Confirm you used `db:setup`, not only `db:start`. Check bootstrap result and local Storage. Do not point the app at production to fill missing data.                            |
| Fixture account cannot sign in      | Confirm the app URL/key target the local API, then run `pnpm db:fixtures`. Hosted accounts are separate.                                                                        |
| Windows script/path error           | Use the Ubuntu terminal, Linux clone and WSL Node/Python together. Avoid reusing a dependency directory installed by Windows Node.                                              |
| Build output becomes inconsistent   | Stop the dev server before `pnpm build` or `pnpm check`; use an isolated `NEXT_DIST_DIR` if simultaneous builds are needed.                                                     |

A local reset is a deliberate data-loss operation, not the first recovery step.
If local edits can be discarded, use the reset/rebootstrap sequence in
[Local setup](local-setup.md). Never use it for hosted recovery.

## Authentication, access and email

| Symptom                                           | Check and recovery                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Confirmation/recovery link goes to the wrong site | Compare `APP_ORIGIN`, Supabase Site URL, allowed redirects and the deployment's domain. Restart/redeploy after corrections and request a fresh link.                                 |
| Recovery link rejected or expired                 | Request a fresh link, use the intended browser/origin and verify the recovery email template and signing secret. Inspect Auth/web logs without sharing the token.                    |
| No email arrives                                  | Check the local test inbox for local development. On hosted projects inspect SMTP, sender verification, provider limits, spam and delivery logs.                                     |
| User cannot open Admin                            | Verify the exact Auth UUID, confirmed email, active profile and effective role grants. First-admin provisioning uses `pnpm db:admin`; changing email text does not grant privileges. |
| User has My Store but cannot manage content       | Navigation visibility does not grant management permission. Inspect effective permissions and the current shared-assortment model.                                                   |
| Unexpected access denied                          | Reproduce with the intended account and environment. Check profile suspension, ownership and server/RLS logs. Do not disable RLS as a workaround.                                    |

## Generation and music

| Symptom                                        | Check and recovery                                                                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basic generation requests OpenRouter           | Check Admin > Prompts generation mode. Local fixtures use fast; fresh hosted content preserves LLM mode. Configure OpenRouter or deliberately select fast.            |
| LLM request fails                              | Check key, model permissions, budget and provider response. A configured key alone does not establish sufficient balance or access.                                   |
| Music analysis is unavailable                  | Check both analyser endpoints, matching shared secret and the receiving Modal deployment.                                                                             |
| Analysis dispatched but never appears complete | Correlate analysis ID with Modal and Vercel callback logs. Check trusted callback origin, deployed routes, model/image health and signed audio reachability.          |
| Audio download rejected                        | Use the correct Supabase project, an unexpired signed URL and the intended allowed hostname. Modal cannot reach a laptop's loopback Storage URL.                      |
| Jamendo search/import fails                    | Check the application client ID, provider response and analyser availability. Re-test a known permitted track and record the actual error.                            |
| Credits appear stuck                           | Inspect job/attempt state and guarded settlement through the admin workflow. Do not edit credit ledger rows directly or repeatedly regenerate while a job is pending. |

### Recover stalled music/cue jobs

An administrator with `admin.manage_imports` can open **Admin > Overview > Generation**
and click **Recover stalled jobs**. The control performs one bounded pass:

- up to one claimable analysis and one ready cue job;
- finalisation of up to ten exhausted attempts of each type through existing refund RPCs;
- no takeover of unexpired leases and no automatic restart of permanent failures.

Review the displayed result and logs. Retryable work may need another deliberate
pass once due. This is not a timer or continuous polling service. Do not loop the
endpoint as an improvised schedule. The admin API is
`POST /api/admin/analyser/reconcile`; trusted internal reconciliation and retention
operations are separate and must retain their normal authentication.

Redeploy the analyser to remove any historical schedule still present in Modal.
A successful web deployment alone does not change that service.

## Video imports, previews and Finale

| Symptom                                      | Check and recovery                                                                                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted import will not dispatch              | Check `/runs` URL, allowed host, 32-512 character shared secret and matching Modal dispatch secret. Production does not fall back to a local polling worker.                  |
| Local import remains queued                  | Run the polling worker in a second terminal. Check Python 3.11, FFmpeg/ffprobe, Node dependencies and same-project worker credentials.                                        |
| Import fails during interpretation/fitting   | Inspect Modal run logs, OpenRouter access/balance and CPU bridge dependencies. Check the clip is decodable before creating another charged attempt.                           |
| Import publication rejects evidence          | Check app/worker/database renderer contract agreement. Revalidate against the current fingerprint through the intended review workflow. Do not bypass the evidence guard.     |
| Replay is blank or slow                      | Check browser WebGL/GPU support and console errors; compare a small known show. Record dense-show performance on the actual client hardware.                                  |
| Preview differs from footage                 | Inspect the selected template, colours and fit. Catalogue template matching is an approximation requiring human review.                                                       |
| Finale warns about unmatched products        | Review Catalogue mappings and the actual external equivalent. A missing mapping intentionally exports a blank ID and warning note.                                            |
| Cake inventory import/export refuses content | Check first shot at 0 ms, eligible single-break designs, supported names, pan/tilt and composition limits in the Finale guide. Fix inputs rather than silently clamping them. |

For a failed import, inspect its persisted run and dispatch/lease state before a
new attempt. Do not manually clear leases or mark work completed in SQL. Escalate
with the run ID, current contract and sanitised error if the UI has no supported
recovery for that state.

## Public QR failures

Test the saved active assortment with a newly copied link. Confirm its products
and quantities, then try a phone using the receiving HTTPS deployment. Production
public endpoints fail closed without both Upstash REST settings. Check those and
provider availability before blaming the QR image. Never publish a laptop
`localhost` URL for shoppers. Handle tokens as access links when sharing evidence.

## Releases and failed deployments

Run focused checks while developing, then `pnpm check`. Run Python, SQL and
cross-language checks when those boundaries change. CI's production release is
migration-before-deployment; inspect the failing stage before taking action.

- A failed migration stops the web release. Identify and repair the migration
  issue, test in an isolated environment and retry the intended checked release.
- If migrations succeeded but the web build/deploy failed, the previous app may
  still be serving against the newer schema. Prefer a compatible fix forward.
- Restoring an older Vercel build does not undo migrations, catalogue edits or
  Modal changes. Use it only after assessing compatibility with current data and
  services. Record the exact build and test the affected journeys.
- A fresh-install verification failure after real users or catalogue edits is
  expected. Do not delete their data or overwrite the catalogue to satisfy it.

Never reset, reseed or repair migration history as a production rollback shortcut.
Keep additive migrations compatible with the running application during rollout.

## Backups, maintenance and costs

Before accepting production, document the actual Supabase backup/PITR entitlement,
retention and restore procedure for the selected plan. Separately account for
Storage objects, Auth configuration, email templates, environment settings and
external provider configuration. A schema dump or curated bootstrap is not a
complete operational backup. Test restoration into an isolated destination and
record the observed recovery time and missing items.

Keep a release record containing web commit/build, applied migrations, Modal
versions/endpoints and configuration-change references. Before risky changes,
confirm a usable backup and recovery owner. Do not practise restoration on the
only production project.

Agree an operational review cadence. Check failed jobs, Auth/email errors,
provider spend, storage/database growth, backup completion, domains and certificate
health. Apply dependency/runtime updates through reviewed branches and checks.
For each provider record the current plan, usage basis, billing owner, alert
threshold, monitoring location and review date. No fixed cost estimate is supplied
because the client's plan and usage have not been established.

## Report an unresolved issue

Provide the release/commit, environment, browser/device, approximate occurrence
time, reproducible steps, expected result, actual result, non-sensitive job IDs
and relevant sanitised logs. Record severity, owner and workaround in the handover
issue register. See the repository [security policy](../../SECURITY.md) for private
security reporting.
