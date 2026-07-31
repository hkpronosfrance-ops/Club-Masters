create table if not exists public.match_team_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  possession numeric(5,2) not null default 50,
  shots integer not null default 0,
  shots_on_target integer not null default 0,
  xg numeric(6,2) not null default 0,
  passes integer not null default 0,
  pass_accuracy numeric(5,2) not null default 0,
  corners integer not null default 0,
  fouls integer not null default 0,
  ppda numeric(6,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(match_id, club_id)
);

create table if not exists public.player_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  minutes integer not null default 90,
  rating numeric(4,2) not null default 6,
  goals integer not null default 0,
  assists integer not null default 0,
  shots integer not null default 0,
  shots_on_target integer not null default 0,
  xg numeric(6,2) not null default 0,
  xa numeric(6,2) not null default 0,
  passes integer not null default 0,
  pass_accuracy numeric(5,2) not null default 0,
  key_passes integer not null default 0,
  tackles integer not null default 0,
  interceptions integer not null default 0,
  duels_won integer not null default 0,
  saves integer not null default 0,
  created_at timestamptz not null default now(),
  unique(match_id, player_id)
);

create index if not exists idx_match_team_stats_club on public.match_team_stats(club_id, created_at desc);
create index if not exists idx_player_match_stats_club on public.player_match_stats(club_id, created_at desc);
create index if not exists idx_player_match_stats_player on public.player_match_stats(player_id, created_at desc);

alter table public.match_team_stats enable row level security;
alter table public.player_match_stats enable row level security;

create policy "Authenticated users can read team stats" on public.match_team_stats for select to authenticated using (true);
create policy "Authenticated users can read player stats" on public.player_match_stats for select to authenticated using (true);