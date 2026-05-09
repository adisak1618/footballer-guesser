-- 0014_word_packs.sql
-- Phase 3.2 — word_packs and word_pack_items tables (per FR-3.1 / A2.B).
--
-- Generic word lists for the 'word_list' content_packs handler. Insider and
-- any future text-prompt game can store its content here without bespoke
-- per-game tables. content_packs.source_ref points at word_packs.slug.
--
-- Headball is NOT modified. Phase 3 stays additive (C4).
--
-- Realtime: clients do NOT subscribe to word lists. Tagged with -- no-realtime
-- on the same line as the create table to satisfy the realtime publication
-- gate (scripts/check-realtime-publication.sh, per US-021 / A4).

begin;

create table word_packs ( -- no-realtime
  slug text primary key,
  display_name text not null,
  display_name_th text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table word_pack_items ( -- no-realtime
  pack_slug text not null references word_packs(slug) on delete cascade,
  value text not null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (pack_slug, value)
);

create index word_pack_items_pack_slug_idx on word_pack_items (pack_slug);

-- Anon SELECT only — writes go through SECURITY DEFINER functions or the
-- service-role seed pipeline.
alter table word_packs enable row level security;
alter table word_pack_items enable row level security;

create policy word_packs_anon_select on word_packs
  for select to anon using (true);

create policy word_pack_items_anon_select on word_pack_items
  for select to anon using (true);

commit;
