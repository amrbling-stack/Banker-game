-- ============================================================================
-- Ras El-Mal Companion — Feature 1: Player Creation & Game Lobby
-- ============================================================================
-- Scope: this migration creates ONLY what the lobby feature needs — creating
-- a game, joining it, seeing other players live, and starting the game
-- (i.e. flipping status from SETUP to ACTIVE and locking in seating/play
-- order). It intentionally does NOT create deeds, news deck, ledger, auction,
-- or scoring tables — those belong to other features and are out of scope
-- for this build.
--
-- The `game_status` enum includes the full lifecycle from the product spec
-- so later features don't require an enum migration, but this feature only
-- ever writes SETUP and ACTIVE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'game_status') then
    create type game_status as enum (
      'SETUP',
      'ACTIVE',
      'ENDGAME_COUNTDOWN',
      'SCORING',
      'COMPLETE'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Table: games
-- ----------------------------------------------------------------------------
create table if not exists public.games (
  id                  uuid primary key default gen_random_uuid(),
  join_code           text not null unique,
  status              game_status not null default 'SETUP',
  min_players         int not null default 2,
  max_players         int not null default 6,
  host_player_id      uuid null, -- FK added after players table exists
  starting_player_id  uuid null, -- who rolled highest at physical setup
  active_player_id    uuid null, -- whose turn it is once ACTIVE (Feature 1 sets this once, at start)
  rules_version       text not null default 'prototype-1.1',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint games_min_players_check check (min_players >= 2),
  constraint games_max_players_check check (max_players <= 6 and max_players >= min_players)
);

comment on table public.games is
  'One row per game session/lobby. Feature 1 only mutates status SETUP -> ACTIVE.';

-- ----------------------------------------------------------------------------
-- Table: players
-- ----------------------------------------------------------------------------
create table if not exists public.players (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games(id) on delete cascade,
  user_id         uuid not null, -- Supabase auth uid (anonymous auth), identifies "this device"
  seat_number     int not null,
  display_name    text not null,
  starting_cash   int not null, -- computed at join time: 25000 + 1000 * (seat - 1)
  is_host         boolean not null default false,
  play_order      int null, -- assigned at start-game, 0-based from starting player
  joined_at       timestamptz not null default now(),

  constraint players_seat_range check (seat_number between 1 and 6),
  constraint players_display_name_len check (char_length(trim(display_name)) between 1 and 24),
  constraint players_unique_seat unique (game_id, seat_number),
  constraint players_unique_device_per_game unique (game_id, user_id)
);

comment on table public.players is
  'One row per player per game. Identified by Supabase anonymous auth user_id so a refreshed device rejoins as the same seat.';

alter table public.games
  add constraint games_host_player_fk
  foreign key (host_player_id) references public.players(id) on delete set null;

alter table public.games
  add constraint games_starting_player_fk
  foreign key (starting_player_id) references public.players(id) on delete set null;

alter table public.games
  add constraint games_active_player_fk
  foreign key (active_player_id) references public.players(id) on delete set null;

create index if not exists idx_players_game_id on public.players(game_id);
create index if not exists idx_games_join_code on public.games(join_code);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_games_updated_at on public.games;
create trigger trg_games_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Helper: generate a short, unambiguous join code (e.g. "K7QX4P")
-- Excludes 0/O/1/I/L to avoid misreads when players type it in.
-- ----------------------------------------------------------------------------
create or replace function public.generate_join_code(p_length int default 6)
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..p_length loop
    result := result || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: create_game
-- Creates a game and its host player atomically. Returns the new game_id
-- and player_id. Runs as SECURITY DEFINER so RLS never blocks the write;
-- callers only ever reach this through the create-game Edge Function.
-- ----------------------------------------------------------------------------
create or replace function public.create_game(
  p_display_name text,
  p_user_id uuid
)
returns table (game_id uuid, player_id uuid, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_player_id uuid;
  v_code text;
  v_attempts int := 0;
begin
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22004';
  end if;
  if trim(coalesce(p_display_name, '')) = '' then
    raise exception 'display_name is required' using errcode = '22004';
  end if;

  -- Generate a unique join code, retrying on the rare collision.
  loop
    v_code := public.generate_join_code(6);
    v_attempts := v_attempts + 1;
    exit when not exists (select 1 from public.games g where g.join_code = v_code);
    if v_attempts > 20 then
      raise exception 'could not generate a unique join code';
    end if;
  end loop;

  insert into public.games (join_code, status)
  values (v_code, 'SETUP')
  returning id into v_game_id;

  insert into public.players (game_id, user_id, seat_number, display_name, starting_cash, is_host)
  values (v_game_id, p_user_id, 1, trim(p_display_name), 25000, true)
  returning id into v_player_id;

  update public.games set host_player_id = v_player_id where id = v_game_id;

  return query select v_game_id, v_player_id, v_code;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: join_game
-- Locks the game row so two simultaneous joins can never grab the same
-- seat. Rejects if the game has started, is full, or the display name is
-- already taken at the table. If this user_id already has a seat in this
-- game (e.g. a refreshed device), returns their existing seat instead of
-- creating a duplicate.
-- ----------------------------------------------------------------------------
create or replace function public.join_game(
  p_join_code text,
  p_display_name text,
  p_user_id uuid
)
returns table (game_id uuid, player_id uuid, seat_number int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game record;
  v_existing record;
  v_seat int;
  v_new_player_id uuid;
  v_starting_cash int;
begin
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22004';
  end if;
  if trim(coalesce(p_display_name, '')) = '' then
    raise exception 'display_name is required' using errcode = '22004';
  end if;

  select * into v_game
  from public.games
  where join_code = upper(trim(p_join_code))
  for update;

  if not found then
    raise exception 'no game found with that code' using errcode = 'P0002';
  end if;

  if v_game.status <> 'SETUP' then
    raise exception 'this game has already started' using errcode = '55000';
  end if;

  -- Rejoining device: return the seat they already have.
  select * into v_existing
  from public.players
  where game_id = v_game.id and user_id = p_user_id;

  if found then
    return query select v_game.id, v_existing.id, v_existing.seat_number;
    return;
  end if;

  select count(*) into v_seat from public.players where game_id = v_game.id;

  if v_seat >= v_game.max_players then
    raise exception 'this lobby is full' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.players
    where game_id = v_game.id
      and lower(display_name) = lower(trim(p_display_name))
  ) then
    raise exception 'that name is already taken in this lobby' using errcode = '23505';
  end if;

  v_seat := v_seat + 1;
  v_starting_cash := 25000 + 1000 * (v_seat - 1);

  insert into public.players (game_id, user_id, seat_number, display_name, starting_cash, is_host)
  values (v_game.id, p_user_id, v_seat, trim(p_display_name), v_starting_cash, false)
  returning id into v_new_player_id;

  return query select v_game.id, v_new_player_id, v_seat;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: leave_game
-- Removes the calling player's own seat. If the host leaves, host status
-- passes to the lowest remaining seat number. If the lobby becomes empty
-- the game row is left as an empty SETUP game (cleanup is out of scope for
-- this feature).
-- ----------------------------------------------------------------------------
create or replace function public.leave_game(
  p_player_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player record;
  v_next_host uuid;
begin
  select * into v_player from public.players where id = p_player_id for update;

  if not found then
    raise exception 'player not found' using errcode = 'P0002';
  end if;

  if v_player.user_id <> p_user_id then
    raise exception 'you can only remove yourself from the lobby' using errcode = '42501';
  end if;

  if exists (select 1 from public.games where id = v_player.game_id and status <> 'SETUP') then
    raise exception 'cannot leave after the game has started' using errcode = '55000';
  end if;

  delete from public.players where id = p_player_id;

  if v_player.is_host then
    select id into v_next_host
    from public.players
    where game_id = v_player.game_id
    order by seat_number asc
    limit 1;

    if v_next_host is not null then
      update public.players set is_host = true where id = v_next_host;
      update public.games set host_player_id = v_next_host where id = v_player.game_id;
    else
      update public.games set host_player_id = null where id = v_player.game_id;
    end if;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: start_game
-- Host-only. Requires 2-6 players. Assigns play_order clockwise starting
-- from p_starting_player_id (the seat that rolled highest, entered by the
-- host after the physical dice roll), sets status ACTIVE.
-- Anything beyond this transition (news deck build, starting balances
-- ledger entries, board state) belongs to other, unbuilt features.
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
      active_player_id = p_starting_player_id
  where id = p_game_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.games enable row level security;
alter table public.players enable row level security;

-- Reads: any signed-in (anonymous auth is fine) device can read lobby state.
-- Nothing sensitive lives in these two tables.
drop policy if exists games_select on public.games;
create policy games_select
  on public.games for select
  using (auth.uid() is not null);

drop policy if exists players_select on public.players;
create policy players_select
  on public.players for select
  using (auth.uid() is not null);

-- Writes: no direct table writes from clients. All mutations go through the
-- SECURITY DEFINER RPCs above, called via the Edge Functions, so every write
-- is validated (seat limits, host-only actions, name collisions, etc).
drop policy if exists games_no_direct_write on public.games;
create policy games_no_direct_write
  on public.games for all
  using (false)
  with check (false);

drop policy if exists players_no_direct_write on public.players;
create policy players_no_direct_write
  on public.players for all
  using (false)
  with check (false);

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.players;
