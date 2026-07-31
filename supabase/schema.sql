-- ============================================================
-- DYNASTY ELEVEN — SCHEMA MVP
-- ============================================================

-- 1. PROFILS (1 profil = 1 utilisateur = 1 club humain)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  club_id uuid,
  created_at timestamptz default now()
);

-- 2. CLUBS
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null, -- null = club IA
  is_ai boolean not null default false,
  name text not null,
  short_name text not null,
  primary_color text not null default '#C81E3A',
  secondary_color text not null default '#FFFFFF',
  crest_shape text not null default 'shield',
  crest_icon text not null default 'ball',
  balance bigint not null default 5000000, -- en euros virtuels
  reputation int not null default 50, -- 0-100
  formation text not null default '4-3-3',
  tactic_style text not null default 'balanced', -- offensif / defensif / possession / contre / balanced
  mentality int not null default 50, -- 0 (ultra def) - 100 (ultra offensif)
  wins int not null default 0,
  draws int not null default 0,
  losses int not null default 0,
  created_at timestamptz default now(),
  constraint clubs_crest_shape_check check (crest_shape in ('shield', 'round', 'diamond')),
  constraint clubs_primary_color_hex_check check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint clubs_secondary_color_hex_check check (secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);

alter table profiles
  add constraint fk_profiles_club foreign key (club_id) references clubs(id) on delete set null;

-- 3. JOUEURS
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete set null,
  first_name text not null,
  last_name text not null,
  age int not null,
  position text not null, -- GK, DC, DL, DR, MDC, MC, MOC, AG, AD, BU
  overall int not null,
  potential int not null,
  pace int not null,
  shooting int not null,
  passing int not null,
  defending int not null,
  physical int not null,
  morale int not null default 70, -- 0-100
  fatigue int not null default 0, -- 0 (frais) - 100 (épuisé)
  form int not null default 50, -- 0-100, forme du moment
  value bigint not null default 100000,
  wage bigint not null default 5000,
  contract_until date,
  is_listed boolean not null default false,
  listed_price bigint,
  created_at timestamptz default now()
);

create index if not exists idx_players_club on players(club_id);
create index if not exists idx_players_listed on players(is_listed) where is_listed = true;

-- 4. MATCHS
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  home_club_id uuid references clubs(id) not null,
  away_club_id uuid references clubs(id) not null,
  home_score int,
  away_score int,
  events jsonb default '[]'::jsonb, -- liste d'events horodatés (buts, cartons...)
  home_strength numeric,
  away_strength numeric,
  played_at timestamptz default now()
);

-- 5. TRANSFERTS (historique)
create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id),
  from_club_id uuid references clubs(id),
  to_club_id uuid references clubs(id),
  fee bigint not null,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — MVP : lecture publique, écriture restreinte
-- ============================================================
alter table profiles enable row level security;
alter table clubs enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table transfers enable row level security;

create policy "profiles_select_all" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

create policy "clubs_select_all" on clubs for select using (true);
create policy "clubs_update_own" on clubs for update using (
  owner_id = auth.uid()
);
create policy "clubs_insert_own" on clubs for insert with check (
  owner_id = auth.uid() or owner_id is null
);

create policy "players_select_all" on players for select using (true);
create policy "players_update_own_club" on players for update using (
  club_id in (select id from clubs where owner_id = auth.uid())
);

create policy "matches_select_all" on matches for select using (true);
create policy "matches_insert_participant" on matches for insert with check (
  home_club_id in (select id from clubs where owner_id = auth.uid())
  or away_club_id in (select id from clubs where owner_id = auth.uid())
);

create policy "transfers_select_all" on transfers for select using (true);
