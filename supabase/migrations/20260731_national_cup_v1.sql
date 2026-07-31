create table if not exists cup_competitions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id) on delete cascade,
  name text not null default 'Coupe Nationale',
  status text not null default 'active' check (status in ('active','finished')),
  current_round int not null default 1,
  champion_club_id uuid references clubs(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists cup_matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references cup_competitions(id) on delete cascade,
  round int not null check (round between 1 and 3),
  match_order int not null,
  home_club_id uuid references clubs(id) on delete set null,
  away_club_id uuid references clubs(id) on delete set null,
  home_score int,
  away_score int,
  extra_time boolean not null default false,
  home_penalties int,
  away_penalties int,
  winner_club_id uuid references clubs(id) on delete set null,
  played boolean not null default false,
  played_at timestamptz,
  unique (competition_id, round, match_order)
);

create table if not exists club_trophies (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  competition_name text not null,
  season_name text,
  won_at timestamptz not null default now(),
  unique (club_id, competition_name, season_name)
);

create index if not exists idx_cup_matches_competition_round on cup_matches(competition_id, round, match_order);
create index if not exists idx_club_trophies_club on club_trophies(club_id, won_at desc);

alter table cup_competitions enable row level security;
alter table cup_matches enable row level security;
alter table club_trophies enable row level security;

create policy "cup_competitions_select_all" on cup_competitions for select using (true);
create policy "cup_matches_select_all" on cup_matches for select using (true);
create policy "club_trophies_select_all" on club_trophies for select using (true);
