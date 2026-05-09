-- 0015_get_random_pack_item.sql
-- Phase 3.3 — get_random_pack_item RPC with handler dispatch (per A2.B / FR-3.2).
--
-- Single API for picking content. Apps call get_random_pack_item(slug) and
-- never query underlying lookup tables directly. The function dispatches based
-- on content_packs.handler:
--   football_category → category_players ⨝ football_players
--   word_list         → word_pack_items
--
-- Returns a single random row (item_id, display_value, metadata) per call.
-- Unknown slug raises SQLSTATE 'PG001' which is the symbolic mapping of
-- PGAME01 (cross-game "pack not found"). PostgreSQL rejects 7-char errcodes
-- as condition names, so per packages/core/error-codes.md we map
-- PGAMExx → SQLSTATE 'PGxxx' (5-char, class 'PG' is unreserved by PG).
--
-- Headball is NOT modified to use this layer (C4: Phase 3 stays additive).

begin;

create or replace function get_random_pack_item(p_slug text)
returns table(item_id text, display_value text, metadata jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handler    text;
  v_source_ref text;
begin
  select cp.handler, cp.source_ref
    into v_handler, v_source_ref
    from content_packs cp
   where cp.slug = p_slug;

  if v_handler is null then
    raise exception 'PGAME01: pack not found: %', p_slug using errcode = 'PG001';
  end if;

  if v_handler = 'football_category' then
    return query
      select fp.id::text,
             fp.name,
             jsonb_build_object(
               'nationalities', fp.nationalities,
               'position',      fp.position
             )
        from category_players cp
        join football_players fp on fp.id = cp.player_id
       where cp.category_slug = v_source_ref
       order by random()
       limit 1;
  elsif v_handler = 'word_list' then
    return query
      select wpi.value,
             wpi.value,
             wpi.metadata
        from word_pack_items wpi
       where wpi.pack_slug = v_source_ref
       order by random()
       limit 1;
  else
    -- Unreachable in practice (content_packs.handler is CHECK-constrained)
    -- but keeps the contract explicit if a future handler is added without
    -- updating this dispatch.
    raise exception 'PGAME01: unknown handler: %', v_handler using errcode = 'PG001';
  end if;
end;
$$;

grant execute on function get_random_pack_item(text) to anon;

commit;
