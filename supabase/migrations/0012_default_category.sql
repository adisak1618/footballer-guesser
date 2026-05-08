-- 0012_default_category.sql
-- Switch the default rooms.category from 'premier-league' to 'worldwide-stars'
-- so first-time hosts land on the globally-recognizable elite pool
-- (sitelinks ≥ 100 — Messi, Maradona, Beckham, Mbappé, etc.) by default.
-- The 'premier-league' category still exists; it's just no longer the default.

begin;

alter table rooms alter column category set default 'worldwide-stars';

commit;
