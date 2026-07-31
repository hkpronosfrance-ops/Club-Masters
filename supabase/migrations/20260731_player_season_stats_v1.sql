create table if not exists player_season_stats (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  appearances integer not null default 0,
  starts integer not null default 0,
  minutes integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  shots integer not null default 0,
  shots_on_target integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  clean_sheets integer not null default 0,
  goals_conceded integer not null default 0,
  saves integer not null default 0,
  man_of_match integer not null default 0,
  rating_total numeric(10,2) not null default 0,
  rating_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(season_id, player_id)
);

create index if not exists idx_player_season_stats_season_goals
  on player_season_stats(season_id, goals desc, assists desc);
create index if not exists idx_player_season_stats_season_assists
  on player_season_stats(season_id, assists desc, goals desc);
create index if not exists idx_player_season_stats_season_rating
  on player_season_stats(season_id, rating_total desc, rating_count desc);
create index if not exists idx_player_season_stats_club
  on player_season_stats(club_id, season_id);

alter table player_season_stats enable row level security;

create or replace view player_season_leaderboard as
select
  pss.*,
  p.first_name,
  p.last_name,
  p.age,
  p.position,
  p.overall,
  p.potential,
  c.name as club_name,
  case when pss.rating_count > 0 then round(pss.rating_total / pss.rating_count, 2) else 0 end as average_rating
from player_season_stats pss
join players p on p.id = pss.player_id
join clubs c on c.id = pss.club_id;
