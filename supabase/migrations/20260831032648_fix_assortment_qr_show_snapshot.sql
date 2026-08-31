-- Use a distinct variable name so snapshot inserts cannot confuse the new
-- show's identifier with show_assortment_items.show_id.

create or replace function public.create_assortment_qr_show(
  p_assortment_token text,
  p_selection_id uuid,
  p_public_access_token_hash text,
  p_title text,
  p_generation_mode text,
  p_selected_cue_model text,
  p_credit_action_key text,
  p_cover_shader jsonb,
  p_source_show_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.assortment_public_links;
  assortment_row public.assortments;
  selection_row public.assortment_song_selections;
  source_show_row public.shows;
  new_show_id uuid := gen_random_uuid();
  show_slug text := 'assortment-show-' || left(replace(gen_random_uuid()::text, '-', ''), 12);
  item_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  if p_generation_mode not in ('fast', 'llm')
    or p_public_access_token_hash !~ '^[a-f0-9]{64}$'
    or nullif(btrim(p_title), '') is null
    or char_length(btrim(p_title)) > 120
  then
    raise exception 'Invalid QR show request.' using errcode = '22023';
  end if;

  select * into link_row
  from public.assortment_public_links link
  where link.public_token = p_assortment_token
    and link.is_enabled = true
  for share;
  if not found then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  select * into assortment_row
  from public.assortments assortment
  where assortment.id = link_row.assortment_id
    and assortment.is_active = true
  for share;
  if not found then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.users funding_user
    where funding_user.id = link_row.funding_user_id
      and funding_user.status = 'active'
  ) then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  select * into selection_row
  from public.assortment_song_selections selection
  where selection.id = p_selection_id
    and selection.assortment_id = assortment_row.id
    and selection.funding_user_id = link_row.funding_user_id
    and selection.music_analysis_id is not null
  for share;
  if not found or not exists (
    select 1 from public.song_analyses analysis
    where analysis.id = selection_row.music_analysis_id
      and analysis.user_id = link_row.funding_user_id
      and analysis.status in ('running', 'completed')
  ) then
    raise exception 'Song selection unavailable.' using errcode = 'P0002';
  end if;

  if p_source_show_id is not null then
    select * into source_show_row
    from public.shows source_show
    where source_show.id = p_source_show_id
      and source_show.user_id = link_row.funding_user_id
      and source_show.creation_source = 'assortment_qr'
      and source_show.assortment_id = assortment_row.id
      and source_show.assortment_song_selection_id = selection_row.id
    for share;
    if not found then
      raise exception 'Source show unavailable.' using errcode = 'P0002';
    end if;

    select count(*)::integer into item_count
    from public.show_assortment_items snapshot
    where snapshot.show_id = source_show_row.id;
  else
    select count(*)::integer into item_count
    from public.assortment_items item
    where item.assortment_id = assortment_row.id;
  end if;
  if item_count = 0 then
    raise exception 'Assortment unavailable.' using errcode = 'P0002';
  end if;

  insert into public.shows (
    id,
    user_id,
    slug,
    title,
    song,
    status,
    duration_seconds,
    budget_cents,
    time_of_day,
    description,
    audio_path,
    music_analysis_id,
    cover_shader,
    show_style,
    selected_cue_model,
    generation_status,
    generation_started_at,
    assortment_id,
    assortment_song_selection_id,
    creation_source,
    public_access_token_hash
  ) values (
    new_show_id,
    link_row.funding_user_id,
    show_slug,
    btrim(p_title),
    selection_row.original_filename,
    'draft',
    null,
    case
      when p_source_show_id is not null then source_show_row.budget_cents
      else assortment_row.price_cents
    end,
    'night',
    'Generated from the fixed ' || assortment_row.name || ' assortment QR.',
    selection_row.audio_path,
    selection_row.music_analysis_id,
    p_cover_shader,
    'signature',
    case when p_generation_mode = 'llm' then p_selected_cue_model else null end,
    'running',
    now(),
    assortment_row.id,
    selection_row.id,
    'assortment_qr',
    p_public_access_token_hash
  );

  if p_source_show_id is not null then
    insert into public.show_assortment_items (show_id, catalogue_item_id, quantity)
    select new_show_id, snapshot.catalogue_item_id, snapshot.quantity
    from public.show_assortment_items snapshot
    where snapshot.show_id = source_show_row.id;
  else
    insert into public.show_assortment_items (show_id, catalogue_item_id, quantity)
    select new_show_id, item.catalogue_item_id, item.quantity
    from public.assortment_items item
    where item.assortment_id = assortment_row.id;
  end if;

  perform private.reserve_assortment_ai_credit(
    link_row.funding_user_id,
    p_credit_action_key,
    'shows',
    new_show_id,
    'show-generation:' || new_show_id::text || ':reserve',
    jsonb_build_object(
      'assortmentId', assortment_row.id,
      'generationMode', p_generation_mode,
      'model', case when p_generation_mode = 'llm' then p_selected_cue_model else null end,
      'sourceShowId', p_source_show_id,
      'source', 'assortment_qr'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'showId', new_show_id,
    'showSlug', show_slug,
    'fundingUserId', link_row.funding_user_id,
    'musicAnalysisId', selection_row.music_analysis_id
  );
end;
$$;

revoke execute on function public.create_assortment_qr_show(
  text, uuid, text, text, text, text, text, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.create_assortment_qr_show(
  text, uuid, text, text, text, text, text, jsonb, uuid
) to service_role;
