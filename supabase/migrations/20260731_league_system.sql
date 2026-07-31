create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active','finished')),
  current_round int not null default 1,
  total_rounds int not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists season_clubs (
  season_id uuid not null references seasons(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  played int not null default 0,
  wins int not null default 0,
  draws int not null default 0,
  losses int not null default 0,
  goals_for int not null default 0,
  goals_against int not null default 0,
  points int not null default 0,
  primary key (season_id, club_id)
);

create table if not exists league_fixtures (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  round int not null,
  home_club_id uuid not null references clubs(id) on delete cascade,
  away_club_id uuid not null references clubs(id) on delete cascade,
  home_score int,
  away_score int,
  played boolean not null default false,
  played_at timestamptz,
  unique (season_id, round, home_club_id, away_club_id)
);

create index if not exists idx_league_fixtures_season_round on league_fixtures(season_id, round);
create index if not exists idx_season_clubs_table on season_clubs(season_id, points desc);

alter table seasons enable row level security;
alter table season_clubs enable row level security;
alter table league_fixtures enable row level security;

create policy "seasons_select_all" on seasons for select using (true);
create policy "season_clubs_select_all" on season_clubs for select using (true);
create policy "league_fixtures_select_all" on league_fixtures for select using (true);
