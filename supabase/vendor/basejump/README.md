# Basejump test helpers

Pinned package: `basejump-supabase_test_helpers` **0.0.6**, as listed on
[database.dev](https://database.dev/basejump/supabase_test_helpers).

- Source repository: https://github.com/usebasejump/supabase-test-helpers
- Source revision: `d90a51f197d49f0a2af155462669cf1dc0218534`
- SQL: `supabase_test_helpers--0.0.6.sql`, unchanged from that revision.
- Licence: MIT, reproduced in `LICENSE.md`.
- SQL SHA-256: `abbf1e29994e03d15c7e8c4b0ac7aa33833931e320dbf4f06cab8e842bfe737f`
- Licence SHA-256: `b146928574c53dd2a9e2e6c47682a8365b2477313ad8d8d036cbf14805eb597f`

Installation uses vendored SQL, not dbdev or a network fetch during reset or tests.
`pnpm db:test` checks the SQL checksum, removes only the upstream psql extension
loading guard, and prepends the SQL to each test inside `BEGIN` / `ROLLBACK`.
The CLI supplies pgTAP. No Basejump extension registration or test helper is added
to the application migrations. The upstream functions retain their original search
paths and grants; they exist only within disposable test transactions.

Do not edit the upstream SQL. A version update must replace the source and licence,
record the new source revision and checksums, and update the runner's pin.
