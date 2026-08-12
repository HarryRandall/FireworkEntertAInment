# Backend Lifecycle

ShowCrafter's asynchronous backend work must reach a durable terminal state
even when a Vercel callback, Modal request, database connection, or process
stops unexpectedly.

## Lifecycle contract

Every cost-bearing background job follows the same boundaries:

1. Validate the authenticated caller and owned inputs.
2. Reserve AI credits under an idempotency key.
3. Persist the user-visible job before dispatch.
4. Claim work with an opaque, expiring lease token.
5. Reject completion, retry, or failure from a stale token.
6. Retry only transient failures, with a bounded attempt count.
7. Commit terminal state and credit settlement or refund in one database
   transaction.
8. Reconcile expired leases and dependent work from a trusted scheduler.
9. Retain referenced private media and remove aged unreferenced media.
10. Record exhausted or operationally blocked work as a dead letter.

Music upload remains separate from show creation. Analysis may begin quietly
after upload, but only the final Generate action creates a show and makes cue
generation claimable.

## Song analysis

Song analysis uses 60-second leases around durable Modal submission and polling,
with at most three submissions. A persisted Modal call ID is polled without
consuming another attempt. Network failures and HTTP 408, 425, 429, or
retryable 5xx responses retry after 30 then 120 seconds. Configuration,
authentication, and invalid-output errors fail immediately. Analysis output
and its credit resolution commit together.

## Cue generation

Cue generation also uses a 15-minute lease and at most three claims. A show
whose music analysis is still running is not claimable, so dependency waiting
does not consume an attempt. The reservation's action key preserves the
original fast or LLM generation mode during recovery; Beat precision remains a
deterministic override.

Timeline replacement is idempotent. Database availability failures and
derived-total finalisation failures are retried after 30 then 120 seconds.
Completion verifies the stored cue count before atomically marking the show
completed and settling credits. Terminal failure atomically marks the show
failed and refunds credits.

## Reconciliation

`platform/vercel.json` schedules two independent protected routes once per
minute:

- `GET /api/admin/analyser/reconcile` runs at most one short analysis
  submit/poll operation. It also performs bounded analysis expiry, credit
  repair, private-audio retention, dead-letter inspection, and health reads.
- `GET /api/admin/cue-generation/reconcile` expires a bounded batch of
  exhausted cue leases and claims at most one ready cue-generation job.

Separating these queues means a running analysis, or any number of running
analyses, cannot consume the cue queue's reconciliation opportunity. The cue
claim checks for a completed or failed linked analysis before incrementing the
show's attempt count, so dependency waiting does not consume a false attempt.

Together the routes:

- expire analyses and cue jobs that exhausted three claims;
- repair legacy terminal show credit reservations;
- remove retained or orphaned private audio in bounded batches;
- record cleanup errors and exhausted work as dead letters;
- return a backend health snapshot.

Both endpoints require `SUPABASE_SERVICE_ROLE_KEY` and
`Authorization: Bearer <CRON_SECRET>`. They allow a missing secret only in
development and fail closed elsewhere. The Vercel project Root Directory must
be `platform`; once-per-minute Cron requires a Pro or Enterprise plan. Configure
`CRON_SECRET` in production before deploying, then verify that both jobs are
registered and producing successful logs in the Vercel Cron dashboard. The
repository configuration and tests make scheduler removal visible, but local
source review cannot prove that a production deployment is active.

## Private audio retention

Audio referenced by a show or song analysis is never selected as an orphan.
Completed or failed analyses that have no show reference are retained for seven
days, then the database row is deleted transactionally before Storage removal.
This ordering prevents a show from attaching the analysis during cleanup.

Storage objects with no show or analysis reference receive a 24-hour grace
period, covering the upload-to-analysis handoff. Storage deletion failures
remain visible as `audio_cleanup` dead letters.

## Operations

`GET /api/admin/backend-lifecycle` returns health counters and up to 100 open
dead letters. `PATCH /api/admin/backend-lifecycle` resolves or ignores one open
record:

```json
{
  "deadLetterId": "00000000-0000-0000-0000-000000000000",
  "status": "resolved",
  "note": "Modal deployment restored and job replayed"
}
```

Both operations require `Authorization: Bearer <CRON_SECRET>`. Resolution is
an operator acknowledgement, not an automatic replay. Replaying cost-bearing
work needs a separate guarded product action so an acknowledgement cannot
silently spend credits.
