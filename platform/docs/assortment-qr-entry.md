# Assortment QR entry

FIR-178 owns `assortments`, `assortment_items`, pricing, status and admin CRUD.
FIR-168 adds a protected `assortment_public_links` row without creating another
assortment model. Its random reusable token is resolved only by trusted server
code and is never granted to `anon`, even though active assortment catalogue
rows remain publicly readable under FIR-178's policies.

The public link stores an interim `funding_user_id`. Music analysis and show
generation reserve, settle or refund that user's existing AI credit account.
Consumers remain anonymous and never receive retailer credentials. A future
retailer organisation or billing-account model may replace this single-user
boundary, but must preserve the credit and capability invariants.

Initial generation captures the current FIR-178 items in immutable
`show_assortment_items` rows. Every planner and the final database write require
the generated timeline to consume each snapshotted SKU exactly the recorded
number of times. Unknown, overused and underused products fail generation.
Supplier availability and later assortment edits cannot change this physical
pack snapshot.

Regeneration proves access to the previous public show and copies that show's
snapshot, price and song selection into a new show. It never reads the
retailer's latest assortment items. A new scan and initial generation capture a
new snapshot.

Deactivated, revoked or invalid links fail closed. Hard deletion remains a
FIR-178 follow-up policy; replay and audit rely on `creation_source`, the song
selection and the immutable product snapshot if `shows.assortment_id` is later
set to null by FIR-178's foreign key.
