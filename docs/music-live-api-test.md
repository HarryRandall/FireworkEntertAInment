# Live music API verification (2026-09-06)

The connected Supabase project was queried and the deployed public read-only endpoints were tested over HTTPS. No show was created, no analysis was started, no credits were charged, and no database was modified.

## Verified

- `GET https://showcrafter.vercel.app/api/health/supabase`: HTTP 200 with `ok: true`.
- An invalid assortment token returned HTTP 404 with `Assortment unavailable.`.
- The database contained three active public QR links and completed Jamendo analyses. Existing QR show records were observed but are not evidence of a new generation succeeding.

## Analysis compatibility finding and fix

The live data included both schema 1.4.0 and 1.5.0 analyses. Before the fix, a 1.5.0 payload was rejected because it added `bar_grid_confidence`. The validator now accepts 1.4.0 and 1.5.0 explicitly, requires a finite confidence value between 0 and 1 for 1.5.0, and preserves all timing, ordering, range, unknown-field, and unknown-version checks.

The real `Athens` 1.4.0 payload and `The Positive Corporate Tech` 1.5.0 payload both pass the updated validator. The latter preserves confidence `0.195` and 242 beat times. No data migration or re-analysis is required.

## Deployed endpoint checks

After explicit authorisation, the existing `qr_test` public token was used only for GET requests against `https://showcrafter.vercel.app`:

| Test                                   | HTTP | Result                                                                |
| -------------------------------------- | ---- | --------------------------------------------------------------------- |
| Browse with `mode=browse&count=5`      | 200  | 29 provider tracks                                                    |
| Search `q=Athens`                      | 200  | `Athens` by Pierce Murphy, track `1860165`                            |
| Unknown genre                          | 400  | Rejected with `Unknown genre.`                                        |
| One-character search                   | 400  | Rejected with the minimum-length message                              |
| `mode=recommend` on the old deployment | 400  | The deployed version did not yet include the new recommendation route |

Browse and search returned `Cache-Control: private, no-store, max-age=0`. Tracks had Jamendo provider IDs, valid durations, HTTPS previews, and permitted CC BY or CC0 labels. Preview URLs were not downloaded or played.

The full import, analysis, generation, replay, and human listening flow still requires a deployment of this branch and its Preview environment variables.
