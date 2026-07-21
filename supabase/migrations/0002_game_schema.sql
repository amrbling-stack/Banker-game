-- ============================================================================
-- Ras El-Mal Companion — Feature 2: Banking System (the rest of the MVP)
-- ============================================================================
-- Builds on 0001 (lobby). Adds everything needed to actually play the game
-- with the physical board, dice, and deed cards, while this app does every
-- bit of bookkeeping: cash, deed ownership, loans, the market index and
-- interest rate, the news deck, dividends, landings, and final scoring.
--
-- Design assumptions baked into this migration (per the product owner):
--   - One banker operates one browser for the whole game.
--   - Players are trusted; the app is a bookkeeping tool, not a referee.
--   - The board, dice, and deed cards are physical. News cards are NOT
--     physical (the deck lives here) since the assumptions list omits them.
--   - Auctions are decided verbally at the table (open ascending bidding is
--     a physical, social process); the app only needs to record the final
--     sale, so "buy at market price" and "auction result" are the same
--     underlying action: assign_company(company, player, price).
--   - Because payments in this game are frequently "required" (tax,
--     interest, rent), and the app does not implement the full multi-step
--     default sequence (which needs deed liquidation choices a human
--     should make), required payments are simply allowed to take a
--     player's cash negative. The table resolves that physically, exactly
--     like a real ledger would. Voluntary spends (buying, developing,
--     taking on more loan) are still blocked if unaffordable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- players / games: add the live banking columns Feature 1 deferred
-- ----------------------------------------------------------------------------
alter table public.players add column if not exists cash int not null default 0;
alter table public.players add column if not exists loan_notes int not null default 0;

alter table public.games add column if not exists index_position int not null default 2;
alter table public.games add column if not exists rate_position int not null default 1;
alter table public.games add column if not exists reckoning_drawn boolean not null default false;

alter table public.games add constraint games_index_position_range check (index_position between 0 and 4);
alter table public.games add constraint games_rate_position_range check (rate_position between 0 and 3);

-- ----------------------------------------------------------------------------
-- Table: companies (static reference — the 30 deed cards, seeded once)
-- ----------------------------------------------------------------------------
create table if not exists public.companies (
  id                        int primary key,
  name_en                   text not null,
  name_ar                   text not null,
  chain_code                text null, -- C1..C9, null for the 3 chainless utilities
  risk_class                text not null check (risk_class in ('DEFENSIVE','CYCLICAL','SPECULATIVE','UTILITY')),
  sticker_price             int not null,
  develops                  boolean not null, -- false for the 3 utilities

  price_70                  int not null,
  price_85                  int not null,
  price_100                 int not null,
  price_115                 int not null,
  price_130                 int not null,

  -- Utilities only ever use the kiosk_* columns (their single FIXED level).
  kiosk_dividend            int not null,
  kiosk_landing_recession   int not null,
  kiosk_landing_normal      int not null,
  kiosk_landing_boom        int not null,
  kiosk_invested            int not null,

  shop_dividend             int null,
  shop_landing_recession    int null,
  shop_landing_normal       int null,
  shop_landing_boom         int null,
  shop_invested             int null,

  chain_dividend            int null,
  chain_landing_recession   int null,
  chain_landing_normal      int null,
  chain_landing_boom        int null,
  chain_invested            int null,

  develop_cost_shop         int null,
  develop_cost_chain        int null,

  buyback_recession         int not null,
  buyback_normal            int not null,
  buyback_boom              int not null
);

comment on table public.companies is
  'Static seed of the 30 deed cards. Values read directly, never recomputed from multipliers — see the deed cards themselves as source of truth.';

insert into public.companies (
  id, name_en, name_ar, chain_code, risk_class, sticker_price, develops,
  price_70, price_85, price_100, price_115, price_130,
  kiosk_dividend, kiosk_landing_recession, kiosk_landing_normal, kiosk_landing_boom, kiosk_invested,
  shop_dividend, shop_landing_recession, shop_landing_normal, shop_landing_boom, shop_invested,
  chain_dividend, chain_landing_recession, chain_landing_normal, chain_landing_boom, chain_invested,
  develop_cost_shop, develop_cost_chain,
  buyback_recession, buyback_normal, buyback_boom
)
values
(1, 'Olive Farm', 'مزرعة زيتون', 'C1', 'DEFENSIVE', 9000, true, 6300, 7650, 9000, 10350, 11700, 450, 450, 450, 450, 9000, 675, 675, 675, 675, 13500, 1125, 1125, 1125, 1125, 22500, 4500, 9000, 2250, 3600, 6750),
(2, 'Butcher Shop', 'محل جزارة', 'C2', 'DEFENSIVE', 8000, true, 5600, 6800, 8000, 9200, 10400, 400, 400, 400, 400, 8000, 600, 600, 600, 600, 12000, 1000, 1000, 1000, 1000, 20000, 4000, 8000, 2000, 3200, 6000),
(3, 'Pharmacy', 'صيدلية', 'C3', 'DEFENSIVE', 10000, true, 7000, 8500, 10000, 11500, 13000, 500, 500, 500, 500, 10000, 750, 750, 750, 750, 15000, 1250, 1250, 1250, 1250, 25000, 5000, 10000, 2500, 4000, 7500),
(5, 'Nursery', 'حضانة', 'C5', 'DEFENSIVE', 8000, true, 5600, 6800, 8000, 9200, 10400, 400, 400, 400, 400, 8000, 600, 600, 600, 600, 12000, 1000, 1000, 1000, 1000, 20000, 4000, 8000, 2000, 3200, 6000),
(6, 'Tech Support', 'خدمة صيانة', 'C7', 'DEFENSIVE', 8000, true, 5600, 6800, 8000, 9200, 10400, 400, 400, 400, 400, 8000, 600, 600, 600, 600, 12000, 1000, 1000, 1000, 1000, 20000, 4000, 8000, 2000, 3200, 6000),
(8, 'Oil Retailer', 'محل زيوت', 'C1', 'DEFENSIVE', 7000, true, 4900, 5950, 7000, 8050, 9100, 350, 350, 350, 350, 7000, 525, 525, 525, 525, 10500, 875, 875, 875, 875, 17500, 3500, 7000, 1750, 2800, 5250),
(9, 'Electronics Store', 'محل إلكترونيات', 'C7', 'CYCLICAL', 12000, true, 8400, 10200, 12000, 13800, 15600, 360, 480, 960, 1920, 12000, 540, 720, 1440, 2880, 18000, 900, 1200, 2400, 4800, 30000, 6000, 12000, 3000, 4800, 9000),
(11, 'Clinic', 'عيادة', 'C3', 'CYCLICAL', 12000, true, 8400, 10200, 12000, 13800, 15600, 360, 480, 960, 1920, 12000, 540, 720, 1440, 2880, 18000, 900, 1200, 2400, 4800, 30000, 6000, 12000, 3000, 4800, 9000),
(12, 'Water Company', 'شركة المياه', NULL, 'UTILITY', 18000, false, 12600, 15300, 18000, 20700, 23400, 900, 900, 900, 900, 18000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4500, 7200, 13500),
(13, 'Poultry Farm', 'مزرعة دواجن', 'C2', 'CYCLICAL', 13000, true, 9100, 11050, 13000, 14950, 16900, 390, 520, 1040, 2080, 13000, 585, 780, 1560, 3120, 19500, 975, 1300, 2600, 5200, 32500, 6500, 13000, 3250, 5200, 9750),
(14, 'Content Studio', 'استوديو محتوى', 'C9', 'CYCLICAL', 14000, true, 9800, 11900, 14000, 16100, 18200, 420, 560, 1120, 2240, 14000, 630, 840, 1680, 3360, 21000, 1050, 1400, 2800, 5600, 35000, 7000, 14000, 3500, 5600, 10500),
(16, 'Medical Lab', 'مختبر تحاليل', 'C4', 'DEFENSIVE', 13000, true, 9100, 11050, 13000, 14950, 16900, 650, 650, 650, 650, 13000, 975, 975, 975, 975, 19500, 1625, 1625, 1625, 1625, 32500, 6500, 13000, 3250, 5200, 9750),
(17, 'Streaming Platform', 'منصة بث', 'C9', 'SPECULATIVE', 16000, true, 6400, 11200, 16000, 20800, 25600, 160, 0, 1600, 4000, 16000, 240, 0, 2400, 6000, 24000, 400, 0, 4000, 10000, 40000, 8000, 16000, 4000, 6400, 12000),
(18, 'Olive Oil Mill', 'معصرة زيت', 'C1', 'CYCLICAL', 14000, true, 9800, 11900, 14000, 16100, 18200, 420, 560, 1120, 2240, 14000, 630, 840, 1680, 3360, 21000, 1050, 1400, 2800, 5600, 35000, 7000, 14000, 3500, 5600, 10500),
(19, 'Private School', 'مدرسة خاصة', 'C5', 'DEFENSIVE', 17000, true, 11900, 14450, 17000, 19550, 22100, 850, 850, 850, 850, 17000, 1275, 1275, 1275, 1275, 25500, 2125, 2125, 2125, 2125, 42500, 8500, 17000, 4250, 6800, 12750),
(21, 'Feed Factory', 'مصنع أعلاف', 'C2', 'CYCLICAL', 17000, true, 11900, 14450, 17000, 19550, 22100, 510, 680, 1360, 2720, 17000, 765, 1020, 2040, 4080, 25500, 1275, 1700, 3400, 6800, 42500, 8500, 17000, 4250, 6800, 12750),
(23, 'Telecom Company', 'شركة الاتصالات', NULL, 'UTILITY', 16000, false, 11200, 13600, 16000, 18400, 20800, 800, 800, 800, 800, 16000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4000, 6400, 12000),
(24, 'Ambulance Service', 'خدمة إسعاف', 'C4', 'DEFENSIVE', 9000, true, 6300, 7650, 9000, 10350, 11700, 450, 450, 450, 450, 9000, 675, 675, 675, 675, 13500, 1125, 1125, 1125, 1125, 22500, 4500, 9000, 2250, 3600, 6750),
(25, 'Internet Provider', 'شركة إنترنت', 'C7', 'DEFENSIVE', 17000, true, 11900, 14450, 17000, 19550, 22100, 850, 850, 850, 850, 17000, 1275, 1275, 1275, 1275, 25500, 2125, 2125, 2125, 2125, 42500, 8500, 17000, 4250, 6800, 12750),
(27, 'Cloud Services', 'خدمات سحابية', 'C8', 'CYCLICAL', 20000, true, 14000, 17000, 20000, 23000, 26000, 600, 800, 1600, 3200, 20000, 900, 1200, 2400, 4800, 30000, 1500, 2000, 4000, 8000, 50000, 10000, 20000, 5000, 8000, 15000),
(28, 'Ad Agency', 'وكالة إعلانات', 'C9', 'SPECULATIVE', 18000, true, 7200, 12600, 18000, 23400, 28800, 180, 0, 1800, 4500, 18000, 270, 0, 2700, 6750, 27000, 450, 0, 4500, 11250, 45000, 9000, 18000, 4500, 7200, 13500),
(29, 'Online Marketplace', 'متجر إلكتروني', 'C6', 'SPECULATIVE', 17000, true, 6800, 11900, 17000, 22100, 27200, 170, 0, 1700, 4250, 17000, 255, 0, 2550, 6375, 25500, 425, 0, 4250, 10625, 42500, 8500, 17000, 4250, 6800, 12750),
(31, 'Payment Platform', 'منصة دفع', 'C6', 'SPECULATIVE', 19000, true, 7600, 13300, 19000, 24700, 30400, 190, 0, 1900, 4750, 19000, 285, 0, 2850, 7125, 28500, 475, 0, 4750, 11875, 47500, 9500, 19000, 4750, 7600, 14250),
(32, 'Pharma Factory', 'مصنع أدوية', 'C3', 'DEFENSIVE', 26000, true, 18200, 22100, 26000, 29900, 33800, 1300, 1300, 1300, 1300, 26000, 1950, 1950, 1950, 1950, 39000, 3250, 3250, 3250, 3250, 65000, 13000, 26000, 6500, 10400, 19500),
(33, 'Electricity Co.', 'شركة الكهرباء', NULL, 'UTILITY', 20000, false, 14000, 17000, 20000, 23000, 26000, 1000, 1000, 1000, 1000, 20000, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5000, 8000, 15000),
(34, 'Private Hospital', 'مستشفى خاص', 'C4', 'DEFENSIVE', 27000, true, 18900, 22950, 27000, 31050, 35100, 1350, 1350, 1350, 1350, 27000, 2025, 2025, 2025, 2025, 40500, 3375, 3375, 3375, 3375, 67500, 13500, 27000, 6750, 10800, 20250),
(36, 'AI Startup', 'شركة ذكاء اصطناعي', 'C8', 'SPECULATIVE', 15000, true, 6000, 10500, 15000, 19500, 24000, 150, 0, 1500, 3750, 15000, 225, 0, 2250, 5625, 22500, 375, 0, 3750, 9375, 37500, 7500, 15000, 3750, 6000, 11250),
(37, 'Private University', 'جامعة خاصة', 'C5', 'DEFENSIVE', 28000, true, 19600, 23800, 28000, 32200, 36400, 1400, 1400, 1400, 1400, 28000, 2100, 2100, 2100, 2100, 42000, 3500, 3500, 3500, 3500, 70000, 14000, 28000, 7000, 11200, 21000),
(38, 'Delivery App', 'تطبيق توصيل', 'C6', 'SPECULATIVE', 21000, true, 8400, 14700, 21000, 27300, 33600, 210, 0, 2100, 5250, 21000, 315, 0, 3150, 7875, 31500, 525, 0, 5250, 13125, 52500, 10500, 21000, 5250, 8400, 15750),
(39, 'Data Center', 'مركز بيانات', 'C8', 'DEFENSIVE', 30000, true, 21000, 25500, 30000, 34500, 39000, 1500, 1500, 1500, 1500, 30000, 2250, 2250, 2250, 2250, 45000, 3750, 3750, 3750, 3750, 75000, 15000, 30000, 7500, 12000, 22500)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Table: game_deeds — ownership + development level, one row per company
-- per game. Seeded (bank-held) when the game starts (see start_game below).
-- ----------------------------------------------------------------------------
create table if not exists public.game_deeds (
  id                uuid primary key default gen_random_uuid(),
  game_id           uuid not null references public.games(id) on delete cascade,
  company_id        int not null references public.companies(id),
  owner_player_id   uuid null references public.players(id) on delete set null,
  dev_level         text not null default 'KIOSK' check (dev_level in ('KIOSK','SHOP','CHAIN','FIXED')),
  updated_at        timestamptz not null default now(),

  constraint game_deeds_unique unique (game_id, company_id)
);

create index if not exists idx_game_deeds_game_id on public.game_deeds(game_id);
create index if not exists idx_game_deeds_owner on public.game_deeds(owner_player_id);

drop trigger if exists trg_game_deeds_updated_at on public.game_deeds;
create trigger trg_game_deeds_updated_at
  before update on public.game_deeds
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: ledger_entries — replaces the paper ledger. Every cash movement,
-- ever, is one row here. balance_after makes the running total auditable
-- without recomputation.
-- ----------------------------------------------------------------------------
create table if not exists public.ledger_entries (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games(id) on delete cascade,
  player_id       uuid not null references public.players(id) on delete cascade,
  seq             bigserial,
  delta           int not null,
  balance_after   int not null,
  reason          text not null,
  description     text null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_ledger_game_seq on public.ledger_entries(game_id, seq);
create index if not exists idx_ledger_player on public.ledger_entries(player_id);

-- ----------------------------------------------------------------------------
-- Table: news_deck — the digital news deck (not a physical component).
-- Built once at start_game per the 7-cards-per-player / 29-card-cap rule,
-- with the Reckoning shuffled into the bottom quarter.
-- ----------------------------------------------------------------------------
create table if not exists public.news_deck (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games(id) on delete cascade,
  draw_order    int not null,
  code          text not null,
  drawn         boolean not null default false,
  drawn_at      timestamptz null,

  constraint news_deck_unique unique (game_id, draw_order)
);

create index if not exists idx_news_deck_game_order on public.news_deck(game_id, draw_order);

-- ----------------------------------------------------------------------------
-- Pure helpers (no table access — safe to call from anywhere)
-- ----------------------------------------------------------------------------
create or replace function public.zone_for(p_index_position int)
returns text
language sql
immutable
as $$
  select case
    when p_index_position <= 1 then 'RECESSION'
    when p_index_position = 2 then 'NORMAL'
    else 'BOOM'
  end;
$$;

create or replace function public.interest_per_note(p_rate_position int)
returns int
language sql
immutable
as $$
  select case p_rate_position
    when 0 then 250
    when 1 then 400
    when 2 then 550
    when 3 then 700
    else 0
  end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: build_news_deck (internal — called by start_game)
-- 7 event cards per player (capped at the full 29), shuffled, with the
-- Reckoning inserted at a random position in the bottom quarter.
-- ----------------------------------------------------------------------------
create or replace function public.build_news_deck(p_game_id uuid, p_player_count int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool text[] := array[]::text[];
  v_composition record;
  v_k int;
  v_selected text[];
  v_total int;
  v_bottom_quarter int;
  v_reckoning_slot int;
  i int;
begin
  for v_composition in
    select * from (values
      ('MARKET_UP_1', 8),
      ('MARKET_DOWN_1', 8),
      ('GAS_FIELD_UP_2', 1),
      ('CRISIS_DOWN_2', 1),
      ('CB_RAISE', 2),
      ('CB_CUT', 2),
      ('FLOTATION', 1),
      ('GOV_OFFERING', 2),
      ('GULF_INVESTOR', 2),
      ('QUIET_DAY', 2)
    ) as t(code, copies)
  loop
    for i in 1..v_composition.copies loop
      v_pool := array_append(v_pool, v_composition.code);
    end loop;
  end loop;

  v_k := least(29, greatest(0, 7 * p_player_count));

  select array_agg(code order by random()) into v_pool from unnest(v_pool) as code;
  v_selected := v_pool[1:v_k];

  delete from public.news_deck where game_id = p_game_id;

  for i in 1..v_k loop
    insert into public.news_deck (game_id, draw_order, code)
    values (p_game_id, i - 1, v_selected[i]);
  end loop;

  v_total := v_k + 1;
  insert into public.news_deck (game_id, draw_order, code)
  values (p_game_id, v_k, 'RECKONING');

  v_bottom_quarter := ceil(v_total / 4.0)::int;
  v_reckoning_slot := v_total - 1 - floor(random() * v_bottom_quarter)::int;

  if v_reckoning_slot <> v_k then
    update public.news_deck set draw_order = -1 where game_id = p_game_id and draw_order = v_reckoning_slot;
    update public.news_deck set draw_order = v_reckoning_slot where game_id = p_game_id and draw_order = v_k;
    update public.news_deck set draw_order = v_k where game_id = p_game_id and draw_order = -1;
  end if;
end;
$$;

revoke execute on function public.build_news_deck(uuid, int) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Extend start_game (Feature 1) to actually seed the game world.
-- Same signature as before — nothing that calls it needs to change.
-- Feature 1 explicitly deferred this: "news deck build, starting balances
-- ledger entries, board state ... belong to other, unbuilt features."
-- This is that feature.
-- ----------------------------------------------------------------------------
create or replace function public.start_game(
  p_game_id uuid,
  p_starting_player_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game record;
  v_host record;
  v_player_count int;
  v_starting_seat int;
  v_rec record;
  v_order int;
begin
  select * into v_game from public.games where id = p_game_id for update;

  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  if v_game.status <> 'SETUP' then
    raise exception 'game has already started' using errcode = '55000';
  end if;

  select * into v_host from public.players where id = v_game.host_player_id;

  if v_host is null or v_host.user_id <> p_user_id then
    raise exception 'only the host can start the game' using errcode = '42501';
  end if;

  select count(*) into v_player_count from public.players where game_id = p_game_id;

  if v_player_count < v_game.min_players then
    raise exception 'need at least % players to start', v_game.min_players using errcode = '55000';
  end if;

  select seat_number into v_starting_seat
  from public.players
  where id = p_starting_player_id and game_id = p_game_id;

  if v_starting_seat is null then
    raise exception 'starting player is not in this game' using errcode = '22023';
  end if;

  -- Assign play_order clockwise (by seat_number) starting from the rolling winner.
  v_order := 0;
  for v_rec in
    select id
    from public.players
    where game_id = p_game_id
    order by ((seat_number - v_starting_seat + 6) % 6), seat_number
  loop
    update public.players set play_order = v_order where id = v_rec.id;
    v_order := v_order + 1;
  end loop;

  update public.games
  set status = 'ACTIVE',
      starting_player_id = p_starting_player_id,
      active_player_id = p_starting_player_id,
      index_position = 2,
      rate_position = 1,
      reckoning_drawn = false
  where id = p_game_id;

  -- Seed cash from each seat's starting_cash (replaces the paper ledger).
  for v_rec in select id, starting_cash from public.players where game_id = p_game_id loop
    update public.players set cash = v_rec.starting_cash, loan_notes = 0 where id = v_rec.id;

    insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
    values (p_game_id, v_rec.id, v_rec.starting_cash, v_rec.starting_cash, 'SETUP', 'Starting cash');
  end loop;

  -- Seed all 30 deeds as bank-held.
  insert into public.game_deeds (game_id, company_id, owner_player_id, dev_level)
  select p_game_id, c.id, null, case when c.develops then 'KIOSK' else 'FIXED' end
  from public.companies c
  on conflict (game_id, company_id) do nothing;

  -- Build the news deck for this player count.
  perform public.build_news_deck(p_game_id, v_player_count);
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: resolve_next_news (internal — draws + applies exactly one card)
-- Shared by collect_go (bundled with dividends/interest) and
-- draw_breaking_news (standalone, for the Breaking News board spaces).
-- ----------------------------------------------------------------------------
create or replace function public.resolve_next_news(p_game_id uuid)
returns table (
  code text,
  index_position int,
  rate_position int,
  reckoning boolean,
  deck_empty boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game record;
  v_card record;
  v_new_index int;
  v_new_rate int;
  v_player record;
  v_new_cash int;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game not found' using errcode = 'P0002';
  end if;

  select * into v_card
  from public.news_deck
  where game_id = p_game_id and drawn = false
  order by draw_order asc
  limit 1
  for update;

  if not found then
    return query select null::text, v_game.index_position, v_game.rate_position, v_game.reckoning_drawn, true;
    return;
  end if;

  update public.news_deck set drawn = true, drawn_at = now() where id = v_card.id;

  v_new_index := v_game.index_position;
  v_new_rate := v_game.rate_position;

  if v_card.code = 'MARKET_UP_1' then
    v_new_index := least(4, v_game.index_position + 1);
  elsif v_card.code = 'MARKET_DOWN_1' then
    v_new_index := greatest(0, v_game.index_position - 1);
  elsif v_card.code = 'GAS_FIELD_UP_2' then
    v_new_index := least(4, v_game.index_position + 2);
  elsif v_card.code = 'CRISIS_DOWN_2' then
    v_new_index := greatest(0, v_game.index_position - 2);
  elsif v_card.code = 'CB_RAISE' then
    v_new_rate := least(3, v_game.rate_position + 1);
  elsif v_card.code = 'CB_CUT' then
    v_new_rate := greatest(0, v_game.rate_position - 1);
  elsif v_card.code = 'FLOTATION' then
    for v_player in select id, cash from public.players where game_id = p_game_id loop
      v_new_cash := (ceil((v_player.cash::numeric / 2) / 100) * 100)::int;
      update public.players set cash = v_new_cash where id = v_player.id;
      insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
      values (p_game_id, v_player.id, v_new_cash - v_player.cash, v_new_cash, 'FLOTATION', 'Flotation: cash halved');
    end loop;
  end if;
  -- GOV_OFFERING / GULF_INVESTOR / QUIET_DAY: no automatic money movement.
  -- The table handles these physically; assign_company / sell_to_bank cover
  -- whatever transaction results.

  update public.games
  set index_position = v_new_index,
      rate_position = v_new_rate,
      status = case when v_card.code = 'RECKONING' and status = 'ACTIVE' then 'ENDGAME_COUNTDOWN' else status end,
      reckoning_drawn = case when v_card.code = 'RECKONING' then true else reckoning_drawn end
  where id = p_game_id;

  return query select v_card.code, v_new_index, v_new_rate, (v_card.code = 'RECKONING'), false;
end;
$$;

revoke execute on function public.resolve_next_news(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- RPC: draw_breaking_news — for the physical board's Breaking News spaces.
-- ----------------------------------------------------------------------------
create or replace function public.draw_breaking_news(p_game_id uuid)
returns table (
  code text,
  index_position int,
  rate_position int,
  reckoning boolean,
  deck_empty boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  return query select * from public.resolve_next_news(p_game_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: collect_go — the whole GO checklist in one call: draw news, then
-- pay this player's dividends (with chain bonus), then charge their loan
-- interest at the (possibly just-changed) rate.
-- ----------------------------------------------------------------------------
create or replace function public.collect_go(p_game_id uuid, p_player_id uuid)
returns table (
  news_code text,
  dividend_total int,
  interest_total int,
  new_cash int,
  index_position int,
  rate_position int,
  reckoning boolean,
  deck_empty boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_news record;
  v_dividend int := 0;
  v_interest int := 0;
  v_rate_position int;
  v_notes int;
  v_rec record;
  v_chain_owned int;
  v_mult numeric;
  v_cash int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (select 1 from public.players where id = p_player_id and game_id = p_game_id) then
    raise exception 'player not found in this game';
  end if;

  select * into v_news from public.resolve_next_news(p_game_id);

  for v_rec in
    select c.chain_code,
      case d.dev_level
        when 'KIOSK' then c.kiosk_dividend
        when 'SHOP' then c.shop_dividend
        when 'CHAIN' then c.chain_dividend
        when 'FIXED' then c.kiosk_dividend
      end as base_dividend
    from public.game_deeds d
    join public.companies c on c.id = d.company_id
    where d.game_id = p_game_id and d.owner_player_id = p_player_id
  loop
    if v_rec.chain_code is null then
      v_mult := 1.0;
    else
      select count(*) into v_chain_owned
      from public.game_deeds d2
      join public.companies c2 on c2.id = d2.company_id
      where d2.game_id = p_game_id
        and d2.owner_player_id = p_player_id
        and c2.chain_code = v_rec.chain_code;

      v_mult := case when v_chain_owned >= 3 then 2.0 when v_chain_owned = 2 then 1.5 else 1.0 end;
    end if;

    v_dividend := v_dividend + floor(coalesce(v_rec.base_dividend, 0) * v_mult)::int;
  end loop;

  if v_dividend <> 0 then
    update public.players set cash = cash + v_dividend where id = p_player_id;
    insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
    select p_game_id, p_player_id, v_dividend, cash, 'DIVIDEND', 'GO dividends'
    from public.players where id = p_player_id;
  end if;

  select g.rate_position into v_rate_position from public.games g where g.id = p_game_id;
  select p.loan_notes into v_notes from public.players p where p.id = p_player_id;
  v_interest := v_notes * public.interest_per_note(v_rate_position);

  if v_interest <> 0 then
    update public.players set cash = cash - v_interest where id = p_player_id;
    insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
    select p_game_id, p_player_id, -v_interest, cash, 'INTEREST', 'Loan interest'
    from public.players where id = p_player_id;
  end if;

  select cash into v_cash from public.players where id = p_player_id;

  return query select
    v_news.code, v_dividend, v_interest, v_cash,
    v_news.index_position, v_news.rate_position, v_news.reckoning, v_news.deck_empty;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: assign_company — buy at market price OR record an auction result.
-- Both are the same transaction from the bank's point of view: an unowned
-- company changes hands for an agreed price. The physical table decides
-- the price (market-price buy, or the winning bid from an open auction);
-- the app just records it.
-- ----------------------------------------------------------------------------
create or replace function public.assign_company(
  p_game_id uuid,
  p_company_id int,
  p_player_id uuid,
  p_price int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deed record;
  v_company record;
  v_player record;
  v_new_cash int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_price < 0 then
    raise exception 'price must be zero or more';
  end if;

  select * into v_deed from public.game_deeds where game_id = p_game_id and company_id = p_company_id for update;
  if not found then
    raise exception 'company not found in this game';
  end if;
  if v_deed.owner_player_id is not null then
    raise exception 'that company is already owned';
  end if;

  select * into v_company from public.companies where id = p_company_id;
  select * into v_player from public.players where id = p_player_id and game_id = p_game_id for update;
  if not found then
    raise exception 'player not found in this game';
  end if;

  if v_player.cash < p_price then
    raise exception 'insufficient funds' using errcode = '55000';
  end if;

  v_new_cash := v_player.cash - p_price;
  update public.players set cash = v_new_cash where id = p_player_id;
  update public.game_deeds
    set owner_player_id = p_player_id,
        dev_level = case when v_company.develops then 'KIOSK' else 'FIXED' end
    where id = v_deed.id;

  insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
  values (p_game_id, p_player_id, -p_price, v_new_cash, 'BUY_COMPANY', v_company.name_en);
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: sell_to_bank — bank buy-back at the current zone price. Development
-- is lost (deed returns to its base level), matching the rules exactly.
-- ----------------------------------------------------------------------------
create or replace function public.sell_to_bank(p_game_id uuid, p_company_id int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deed record;
  v_company record;
  v_game record;
  v_zone text;
  v_price int;
  v_player record;
  v_new_cash int;
  v_base_level text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_deed from public.game_deeds where game_id = p_game_id and company_id = p_company_id for update;
  if not found or v_deed.owner_player_id is null then
    raise exception 'that company is not owned';
  end if;

  select * into v_company from public.companies where id = p_company_id;
  select * into v_game from public.games where id = p_game_id;
  v_zone := public.zone_for(v_game.index_position);
  v_price := case v_zone
    when 'RECESSION' then v_company.buyback_recession
    when 'NORMAL' then v_company.buyback_normal
    else v_company.buyback_boom
  end;

  select * into v_player from public.players where id = v_deed.owner_player_id for update;
  v_new_cash := v_player.cash + v_price;
  update public.players set cash = v_new_cash where id = v_player.id;

  v_base_level := case when v_company.develops then 'KIOSK' else 'FIXED' end;
  update public.game_deeds set owner_player_id = null, dev_level = v_base_level where id = v_deed.id;

  insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
  values (p_game_id, v_player.id, v_price, v_new_cash, 'BANK_BUYBACK', v_company.name_en);
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: develop_company — Kiosk -> Shop -> Chain, one level per call.
-- ----------------------------------------------------------------------------
create or replace function public.develop_company(p_game_id uuid, p_company_id int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deed record;
  v_company record;
  v_player record;
  v_cost int;
  v_next text;
  v_new_cash int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_deed from public.game_deeds where game_id = p_game_id and company_id = p_company_id for update;
  if not found or v_deed.owner_player_id is null then
    raise exception 'that company is not owned';
  end if;

  select * into v_company from public.companies where id = p_company_id;
  if not v_company.develops then
    raise exception 'this company can never be developed';
  end if;

  if v_deed.dev_level = 'KIOSK' then
    v_cost := v_company.develop_cost_shop;
    v_next := 'SHOP';
  elsif v_deed.dev_level = 'SHOP' then
    v_cost := v_company.develop_cost_chain;
    v_next := 'CHAIN';
  else
    raise exception 'this company is already fully developed';
  end if;

  select * into v_player from public.players where id = v_deed.owner_player_id for update;
  if v_player.cash < v_cost then
    raise exception 'insufficient funds' using errcode = '55000';
  end if;

  v_new_cash := v_player.cash - v_cost;
  update public.players set cash = v_new_cash where id = v_player.id;
  update public.game_deeds set dev_level = v_next where id = v_deed.id;

  insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
  values (p_game_id, v_player.id, -v_cost, v_new_cash, 'DEVELOP', v_company.name_en || ' -> ' || v_next);
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: pay_landing — landing on another player's company. Required payment:
-- allowed to take the payer's cash negative (see migration header note).
-- ----------------------------------------------------------------------------
create or replace function public.pay_landing(
  p_game_id uuid,
  p_company_id int,
  p_payer_player_id uuid
)
returns table (amount int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deed record;
  v_company record;
  v_game record;
  v_zone text;
  v_base int;
  v_chain_owned int;
  v_mult numeric;
  v_amount int;
  v_payer record;
  v_owner record;
  v_new_payer_cash int;
  v_new_owner_cash int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_deed from public.game_deeds where game_id = p_game_id and company_id = p_company_id for update;
  if not found or v_deed.owner_player_id is null then
    raise exception 'that company is not owned';
  end if;
  if v_deed.owner_player_id = p_payer_player_id then
    raise exception 'you cannot land on your own company';
  end if;

  select * into v_company from public.companies where id = p_company_id;
  select * into v_game from public.games where id = p_game_id;
  v_zone := public.zone_for(v_game.index_position);

  v_base := case v_deed.dev_level
    when 'KIOSK' then case v_zone when 'RECESSION' then v_company.kiosk_landing_recession when 'NORMAL' then v_company.kiosk_landing_normal else v_company.kiosk_landing_boom end
    when 'SHOP'  then case v_zone when 'RECESSION' then v_company.shop_landing_recession  when 'NORMAL' then v_company.shop_landing_normal  else v_company.shop_landing_boom  end
    when 'CHAIN' then case v_zone when 'RECESSION' then v_company.chain_landing_recession when 'NORMAL' then v_company.chain_landing_normal else v_company.chain_landing_boom end
    when 'FIXED' then v_company.kiosk_landing_normal
  end;

  if v_company.chain_code is null then
    v_mult := 1.0;
  else
    select count(*) into v_chain_owned
    from public.game_deeds d2
    join public.companies c2 on c2.id = d2.company_id
    where d2.game_id = p_game_id
      and d2.owner_player_id = v_deed.owner_player_id
      and c2.chain_code = v_company.chain_code;

    v_mult := case when v_chain_owned >= 3 then 2.0 else 1.0 end;
  end if;

  v_amount := floor(coalesce(v_base, 0) * v_mult)::int;

  select * into v_payer from public.players where id = p_payer_player_id for update;
  if not found then
    raise exception 'payer not found';
  end if;
  select * into v_owner from public.players where id = v_deed.owner_player_id for update;
  if not found then
    raise exception 'owner not found';
  end if;

  v_new_payer_cash := v_payer.cash - v_amount;
  v_new_owner_cash := v_owner.cash + v_amount;

  update public.players set cash = v_new_payer_cash where id = v_payer.id;
  update public.players set cash = v_new_owner_cash where id = v_owner.id;

  insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
  values
    (p_game_id, v_payer.id, -v_amount, v_new_payer_cash, 'LANDING_PAID', v_company.name_en),
    (p_game_id, v_owner.id, v_amount, v_new_owner_cash, 'LANDING_RECEIVED', v_company.name_en);

  return query select v_amount;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: pay_tax — 10% of current cash, rounded down to the nearest 100.
-- ----------------------------------------------------------------------------
create or replace function public.pay_tax(p_game_id uuid, p_player_id uuid)
returns table (amount int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player record;
  v_tax int;
  v_new_cash int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_player from public.players where id = p_player_id and game_id = p_game_id for update;
  if not found then
    raise exception 'player not found';
  end if;

  if v_player.cash <= 0 then
    v_tax := 0;
  else
    v_tax := (floor((v_player.cash * 0.10) / 100) * 100)::int;
  end if;

  if v_tax <> 0 then
    v_new_cash := v_player.cash - v_tax;
    update public.players set cash = v_new_cash where id = p_player_id;
    insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
    values (p_game_id, p_player_id, -v_tax, v_new_cash, 'TAX', '10% tax');
  end if;

  return query select v_tax;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: pay_bank — generic required payment to the bank (e.g. the
-- Government Window's 2,000 fee, or any other flat bank charge).
-- ----------------------------------------------------------------------------
create or replace function public.pay_bank(
  p_game_id uuid,
  p_player_id uuid,
  p_amount int,
  p_label text default 'Payment to bank'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player record;
  v_new_cash int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  select * into v_player from public.players where id = p_player_id and game_id = p_game_id for update;
  if not found then
    raise exception 'player not found';
  end if;

  v_new_cash := v_player.cash - p_amount;
  update public.players set cash = v_new_cash where id = p_player_id;
  insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
  values (p_game_id, p_player_id, -p_amount, v_new_cash, 'ADJUSTMENT', p_label);
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: grant_bank — banker correction / manual credit.
-- ----------------------------------------------------------------------------
create or replace function public.grant_bank(
  p_game_id uuid,
  p_player_id uuid,
  p_amount int,
  p_label text default 'Correction'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player record;
  v_new_cash int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  select * into v_player from public.players where id = p_player_id and game_id = p_game_id for update;
  if not found then
    raise exception 'player not found';
  end if;

  v_new_cash := v_player.cash + p_amount;
  update public.players set cash = v_new_cash where id = p_player_id;
  insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
  values (p_game_id, p_player_id, p_amount, v_new_cash, 'ADJUSTMENT', p_label);
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: take_loan / repay_loan
-- Ceiling: outstanding notes may never total more than half the total
-- sticker value of the player's owned deeds (computed live, not cached).
-- ----------------------------------------------------------------------------
create or replace function public.take_loan(p_game_id uuid, p_player_id uuid, p_note_count int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player record;
  v_sticker_sum int;
  v_ceiling_notes int;
  v_new_cash int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_note_count <= 0 then
    raise exception 'note count must be positive';
  end if;

  select * into v_player from public.players where id = p_player_id and game_id = p_game_id for update;
  if not found then
    raise exception 'player not found';
  end if;

  select coalesce(sum(c.sticker_price), 0) into v_sticker_sum
  from public.game_deeds d
  join public.companies c on c.id = d.company_id
  where d.game_id = p_game_id and d.owner_player_id = p_player_id;

  v_ceiling_notes := floor((0.5 * v_sticker_sum) / 5000);

  if v_player.loan_notes + p_note_count > v_ceiling_notes then
    raise exception 'loan ceiling reached: at most % notes against current holdings', v_ceiling_notes
      using errcode = '55000';
  end if;

  v_new_cash := v_player.cash + (p_note_count * 5000);
  update public.players set cash = v_new_cash, loan_notes = loan_notes + p_note_count where id = p_player_id;

  insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
  values (p_game_id, p_player_id, p_note_count * 5000, v_new_cash, 'LOAN_TAKE', p_note_count || ' note(s)');
end;
$$;

create or replace function public.repay_loan(p_game_id uuid, p_player_id uuid, p_note_count int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player record;
  v_amount int;
  v_new_cash int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_note_count <= 0 then
    raise exception 'note count must be positive';
  end if;

  select * into v_player from public.players where id = p_player_id and game_id = p_game_id for update;
  if not found then
    raise exception 'player not found';
  end if;
  if p_note_count > v_player.loan_notes then
    raise exception 'you do not hold that many notes';
  end if;

  v_amount := p_note_count * 5000;
  if v_amount > v_player.cash then
    raise exception 'insufficient funds to repay' using errcode = '55000';
  end if;

  v_new_cash := v_player.cash - v_amount;
  update public.players set cash = v_new_cash, loan_notes = loan_notes - p_note_count where id = p_player_id;

  insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
  values (p_game_id, p_player_id, -v_amount, v_new_cash, 'LOAN_REPAY', p_note_count || ' note(s)');
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: trade_cash — voluntary player-to-player cash transfer.
-- ----------------------------------------------------------------------------
create or replace function public.trade_cash(
  p_game_id uuid,
  p_from_player_id uuid,
  p_to_player_id uuid,
  p_amount int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from record;
  v_to record;
  v_new_from_cash int;
  v_new_to_cash int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  if p_from_player_id = p_to_player_id then
    raise exception 'cannot trade with yourself';
  end if;

  select * into v_from from public.players where id = p_from_player_id and game_id = p_game_id for update;
  if not found then
    raise exception 'from-player not found';
  end if;
  select * into v_to from public.players where id = p_to_player_id and game_id = p_game_id for update;
  if not found then
    raise exception 'to-player not found';
  end if;

  if v_from.cash < p_amount then
    raise exception 'insufficient funds' using errcode = '55000';
  end if;

  v_new_from_cash := v_from.cash - p_amount;
  v_new_to_cash := v_to.cash + p_amount;
  update public.players set cash = v_new_from_cash where id = v_from.id;
  update public.players set cash = v_new_to_cash where id = v_to.id;

  insert into public.ledger_entries (game_id, player_id, delta, balance_after, reason, description)
  values
    (p_game_id, v_from.id, -p_amount, v_new_from_cash, 'TRADE', 'Paid to ' || v_to.display_name),
    (p_game_id, v_to.id, p_amount, v_new_to_cash, 'TRADE', 'Received from ' || v_from.display_name);
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: finish_game — ends bookkeeping. Final net worth is computed
-- client-side from data already synced (cash, loans, owned deeds, index).
-- ----------------------------------------------------------------------------
create or replace function public.finish_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.games
    set status = 'COMPLETE'
    where id = p_game_id and status in ('ACTIVE', 'ENDGAME_COUNTDOWN');

  if not found then
    raise exception 'game cannot be finished from its current status';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security — new tables
-- ----------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.game_deeds enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.news_deck enable row level security;

drop policy if exists companies_select on public.companies;
create policy companies_select
  on public.companies for select
  using (auth.uid() is not null);

drop policy if exists game_deeds_select on public.game_deeds;
create policy game_deeds_select
  on public.game_deeds for select
  using (auth.uid() is not null);

drop policy if exists ledger_entries_select on public.ledger_entries;
create policy ledger_entries_select
  on public.ledger_entries for select
  using (auth.uid() is not null);

-- Only ever-drawn cards are visible — nobody (including the banker's own
-- browser devtools) can peek at the undrawn order of the deck.
drop policy if exists news_deck_select on public.news_deck;
create policy news_deck_select
  on public.news_deck for select
  using (auth.uid() is not null and drawn = true);

-- No direct writes on any of these — every mutation goes through the
-- SECURITY DEFINER RPCs above.
drop policy if exists companies_no_direct_write on public.companies;
create policy companies_no_direct_write on public.companies for all using (false) with check (false);

drop policy if exists game_deeds_no_direct_write on public.game_deeds;
create policy game_deeds_no_direct_write on public.game_deeds for all using (false) with check (false);

drop policy if exists ledger_entries_no_direct_write on public.ledger_entries;
create policy ledger_entries_no_direct_write on public.ledger_entries for all using (false) with check (false);

drop policy if exists news_deck_no_direct_write on public.news_deck;
create policy news_deck_no_direct_write on public.news_deck for all using (false) with check (false);

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.game_deeds;
alter publication supabase_realtime add table public.ledger_entries;
alter publication supabase_realtime add table public.news_deck;
