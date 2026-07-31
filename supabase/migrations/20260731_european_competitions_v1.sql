create table if not exists european_competitions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id) on delete set null,
  code text not null check (code in ('champions_league','europa_league')),
  name text not null,
  status text not null default 'active' check (status in ('active','finished')),
  current_round int not null default 1,
  champion_club_id uuid references clubs(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists european_matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references european_competitions(id) on delete cascade,
  round int not null check (round between 1 and 3),
  match_order int not null,
  home_club_id uuid not null references clubs(id) on delete cascade,
  away_club_id uuid not null references clubs(id) on delete cascade,
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

create index if not exists idx_european_matches_competition_round on european_matches(competition_id, round);

alter table european_competitions enable row level security;
alter table european_matches enable row level security;

create policy "european_competitions_select_all" on european_competitions for select using (true);
create policy "european_matches_select_all" on european_matches for select using (true);
