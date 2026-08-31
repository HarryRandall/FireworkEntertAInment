-- The linked FIR-178 migration history did not leave this provenance column
-- present, although the QR show RPC and generated types depend on it.

alter table public.shows
  add column if not exists assortment_id uuid
    references public.assortments(id) on delete set null;

create index if not exists shows_assortment_id_idx
  on public.shows (assortment_id)
  where assortment_id is not null;
