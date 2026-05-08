-- 0013_content_packs.sql
-- Phase 3.1 — content_packs registry (per A2.B / FR-3.1).
--
-- A registry of content packs that future games (Insider, etc.) can resolve
-- via get_random_pack_item(slug) without knowing the underlying schema.
-- Each pack declares a `handler` (which underlying lookup to use) and a
-- `source_ref` (the key into that handler's data).
--
-- Headball is NOT modified to use this layer (C4: phase is purely additive).
-- All existing football_category packs map to current category slugs 1:1.

begin;

create table content_packs (
  slug text primary key,
  display_name text not null,
  display_name_th text,
  handler text not null check (handler in ('football_category', 'word_list')),
  source_ref text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Anon SELECT only — writes go through SECURITY DEFINER functions.
alter table content_packs enable row level security;

create policy content_packs_anon_select on content_packs
  for select to anon using (true);

-- Realtime: hosts may subscribe to pack catalog changes (e.g. enabled toggle).
alter publication supabase_realtime add table content_packs;

-- Seed: one row per existing Headball category, all routed through the
-- football_category handler. slug convention: 'football-<category-slug>'.
insert into content_packs (slug, display_name, display_name_th, handler, source_ref) values
  ('football-worldwide-stars',       'Worldwide stars (sitelinks ≥ 100)',          'ดาวดังระดับโลก',                       'football_category', 'worldwide-stars'),
  ('football-premier-league',        'Premier League (any 2025-26 club)',          'พรีเมียร์ลีก',                         'football_category', 'premier-league'),
  ('football-la-liga',               'La Liga (any 2025-26 club)',                 'ลาลีกา',                               'football_category', 'la-liga'),
  ('football-serie-a',               'Serie A (any 2025-26 club)',                 'กัลโช่ เซเรียอา',                       'football_category', 'serie-a'),
  ('football-bundesliga',            'Bundesliga (any 2025-26 club)',              'บุนเดสลีกา',                            'football_category', 'bundesliga'),
  ('football-ligue-1',               'Ligue 1 (any 2025-26 club)',                 'ลีกเอิง',                              'football_category', 'ligue-1'),
  ('football-liverpool',             'Played for Liverpool',                       'เคยเล่นให้ลิเวอร์พูล',                   'football_category', 'liverpool'),
  ('football-man-united',            'Played for Manchester United',               'เคยเล่นให้แมนยู',                       'football_category', 'man-united'),
  ('football-arsenal',               'Played for Arsenal',                         'เคยเล่นให้อาร์เซนอล',                   'football_category', 'arsenal'),
  ('football-chelsea',               'Played for Chelsea',                         'เคยเล่นให้เชลซี',                       'football_category', 'chelsea'),
  ('football-man-city',              'Played for Manchester City',                 'เคยเล่นให้แมนซิตี้',                     'football_category', 'man-city'),
  ('football-tottenham',             'Played for Tottenham',                       'เคยเล่นให้ท็อตแนม',                      'football_category', 'tottenham'),
  ('football-real-madrid',           'Played for Real Madrid',                     'เคยเล่นให้เรอัลมาดริด',                  'football_category', 'real-madrid'),
  ('football-barcelona',             'Played for Barcelona',                       'เคยเล่นให้บาร์ซ่า',                      'football_category', 'barcelona'),
  ('football-atletico',              'Played for Atlético Madrid',                 'เคยเล่นให้แอตเลติโก้',                   'football_category', 'atletico'),
  ('football-juventus',              'Played for Juventus',                        'เคยเล่นให้ยูเวนตุส',                     'football_category', 'juventus'),
  ('football-ac-milan',              'Played for AC Milan',                        'เคยเล่นให้เอซี มิลาน',                   'football_category', 'ac-milan'),
  ('football-inter',                 'Played for Inter Milan',                     'เคยเล่นให้อินเตอร์ มิลาน',                'football_category', 'inter'),
  ('football-bayern',                'Played for Bayern Munich',                   'เคยเล่นให้บาเยิร์น',                     'football_category', 'bayern'),
  ('football-dortmund',              'Played for Borussia Dortmund',               'เคยเล่นให้ดอร์ทมุนด์',                   'football_category', 'dortmund'),
  ('football-psg',                   'Played for Paris Saint-Germain',             'เคยเล่นให้เปแอสเช',                      'football_category', 'psg'),
  ('football-real-and-barca',        'Played for BOTH Real Madrid AND Barcelona',  'เคยเล่นให้ทั้งเรอัลและบาร์ซ่า',          'football_category', 'real-and-barca'),
  ('football-milan-and-inter',       'Played for BOTH AC Milan AND Inter Milan',   'เคยเล่นให้ทั้งมิลานและอินเตอร์',          'football_category', 'milan-and-inter'),
  ('football-arsenal-and-tottenham', 'Played for BOTH Arsenal AND Tottenham',      'เคยเล่นให้ทั้งอาร์เซนอลและท็อตแนม',       'football_category', 'arsenal-and-tottenham'),
  ('football-united-and-city',       'Played for BOTH Manchester United AND Manchester City', 'เคยเล่นให้ทั้งแมนยูและแมนซิตี้', 'football_category', 'united-and-city'),
  ('football-real-and-atletico',     'Played for BOTH Real Madrid AND Atlético Madrid', 'เคยเล่นให้ทั้งเรอัลและแอตเลติโก้',  'football_category', 'real-and-atletico'),
  ('football-real-and-chelsea',      'Played for BOTH Real Madrid AND Chelsea',    'เคยเล่นให้ทั้งเรอัลและเชลซี',            'football_category', 'real-and-chelsea'),
  ('football-english',               'English nationality',                        'นักเตะอังกฤษ',                          'football_category', 'english'),
  ('football-brazilian',             'Brazilian nationality',                      'นักเตะบราซิล',                          'football_category', 'brazilian'),
  ('football-argentinian',           'Argentinian nationality',                    'นักเตะอาร์เจนตินา',                      'football_category', 'argentinian'),
  ('football-french',                'French nationality',                         'นักเตะฝรั่งเศส',                         'football_category', 'french'),
  ('football-german',                'German nationality',                         'นักเตะเยอรมัน',                          'football_category', 'german'),
  ('football-spanish',               'Spanish nationality',                        'นักเตะสเปน',                            'football_category', 'spanish'),
  ('football-italian',               'Italian nationality',                        'นักเตะอิตาลี',                           'football_category', 'italian'),
  ('football-goalkeepers',           'Goalkeepers',                                'ผู้รักษาประตู',                          'football_category', 'goalkeepers'),
  ('football-legends',               'All-time legends (tier 1)',                  'ตำนาน',                                'football_category', 'legends');

commit;
