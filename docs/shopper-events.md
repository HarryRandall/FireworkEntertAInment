# Shopper activity events

Shopper interactions enqueue UUID-only activity in a browser queue. One request carries
up to twenty events after a one-second coalescing window. The queue retains at most
one hundred events and never delays navigation, playback or a transactional write.
Page hiding and exit flush one batch with `keepalive`; delivery remains best-effort.
Rejected or ambiguous requests are reported to the console without replay.

The visit key is an in-memory random UUID. Reloading starts a new visit. No persistent
analytics cookie, IP, email, show title, typed edit message, device fingerprint or
client-supplied money is sent. The cookie-bound route validates the batch and calls
`track_event` for each event, using the existing ownership and rate-limit fences.
The database derives tenancy, shopper identity, campaign and list value.

| Shopper interaction                                  | Event                 | Count metric      |
| ---------------------------------------------------- | --------------------- | ----------------- |
| Resolved live QR reaches a store target              | `scan`                | `scans`           |
| Store range mounts                                   | `store_view`          | `store_views`     |
| Product page mounts                                  | `product_view`        | `product_views`   |
| Viewer starts or resumes playback                    | `play`                | `plays`           |
| Planning successfully creates or recovers a session  | `plan_start`          | `plans`           |
| A candidate or revised candidate is displayed        | `plan_pick`           | `plan_views`      |
| An edit is successfully applied                      | `edit`                | `edits`           |
| A different candidate is successfully returned       | `something_different` | `alternatives`    |
| Product or candidate is successfully added to a list | `list_add`            | `list_adds`       |
| That list write is successfully persisted            | `list_saved`          | `list_saves`      |
| The saved till number is displayed                   | `till_code_shown`     | `till_code_views` |

Mount events ignore React's effect replay, but a reload or later page visit counts
as another view. Play counts actual transitions into playback, including resume.
Failed and infeasible mutations do not produce success events. A persisted list
already belongs to the shopper's Auth UUID; `list_saved` does not claim an email
was delivered or an email address verified. Anonymous email upgrades keep that UUID.
Unavailable or retired QR codes have no validated live store context and are not
submitted as scan events.

## Consent decisions

An explicit `follows.visible_to_shop = false` suppresses activity in every market,
regardless of marketing consent. Saving a choice drops queued and future activity
for every registered location belonging to the organisation. The RPC checks the
current saved choice again immediately before consuming budget and inserting, so
other tabs, account privacy controls and direct transport callers cannot bypass it.
It returns null for a suppressed event. An event already written before refusal is
not retrospectively removed.

No follows row retains the existing analytics behaviour. The schema's customer
visibility fence still requires activity-sharing consent. This implements an explicit
opt-out rule, not a claim that the example market rules establish legal compliance.
No geography-specific legal determination was made.

## Verification and handover

The node tests cover coalescing, queue and batch bounds, dropped queued and future
activity, resumed sharing, rejected payloads and failure reporting without retries.
The pgTAP suite covers the added event vocabulary, rollup projection, activity refusal,
marketing independence and public privilege denial.

`tests/browser/events.spec.ts` is for composer execution against the local application.
It signs in through the shared Auth helpers, traverses QR, product, store, planning,
playback, editing, alternatives, list and till, then queries raw events. It checks
all eleven event kinds, contextual ownership, a shared visit key and explicit opt-out.
A second journey upgrades an anonymous identity through a Mailpit magic link. Neither
journey uses fixed sleeps. The phone journey also asserts no horizontal overflow.

No browser or dev server was started for implementation. Browser execution, screenshots,
owner visual review, CI and production verification remain separate delivery gates.
