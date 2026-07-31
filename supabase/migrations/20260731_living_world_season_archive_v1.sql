-- Monde Vivant V2 : archives et récompenses de fin de saison.
create table if not exists season_archives (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null unique references seasons(id) on delete cascade,
  season_label text not null,
  champion_club_id uuid references clubs(id) on delete set null,
  champion_name text,
  standings jsonb not null default '[]'::jsonb,
  total_clubs integer not null default 0,
  total_matches integer not null default 0,
  total_goals integer not null default 0,
  archived_at timestamptz not null default now()
);

create table if not exists season_awards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  award_code text not null check (award_code in ('player_of_season','top_scorer','top_assist','best_goalkeeper','best_young','best_attack','best_defense','champion')),
  award_label text not null,
  player_id uuid references players(id) on delete set null,
  club_id uuid references clubs(id) on delete set null,
  winner_name text not null,
  value_label text,
  created_at timestamptz not null default now(),
  unique(season_id, award_code)
);

create table if not exists season_best_xi (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  player_name text not null,
  club_id uuid references clubs(id) on delete set null,
  position text not null,
  overall integer,
  created_at timestamptz not null default now(),
  unique(season_id, player_id)
);

create table if not exists club_honours (
  club_id uuid primary key references clubs(id) on delete cascade,
  league_titles integer not null default 0,
  seasons_played integer not null default 0,
  total_wins integer not null default 0,
  total_draws integer not null default 0,
  total_losses integer not null default 0,
  total_goals_for integer not null default 0,
  total_goals_against integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_season_archives_archived on season_archives(archived_at desc);
create index if not exists idx_season_awards_season on season_awards(season_id, award_code);
create index if not exists idx_season_best_xi_season on season_best_xi(season_id, position);

alter table season_archives enable row level security;
alter table season_awards enable row level security;
alter table season_best_xi enable row level security;
alter table club_honours enable row level security;

create or replace function archive_finished_season()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  champion_row record;
  best_attack_row record;
  best_defense_row record;
  player_row record;
  young_row record;
  keeper_row record;
  standings_json jsonb;
  club_count integer;
  match_count integer;
  goal_count integer;
  season_name text;
begin
  if new.status <> 'finished' or old.status = 'finished' then
    return new;
  end if;

  season_name := coalesce(new.name, 'Saison ' || extract(year from coalesce(new.finished_at, now()))::text);

  select sc.*, c.name as club_name into champion_row
  from season_clubs sc join clubs c on c.id = sc.club_id
  where sc.season_id = new.id
  order by sc.points desc, (sc.goals_for - sc.goals_against) desc, sc.goals_for desc
  limit 1;

  select sc.*, c.name as club_name into best_attack_row
  from season_clubs sc join clubs c on c.id = sc.club_id
  where sc.season_id = new.id
  order by sc.goals_for desc, sc.points desc limit 1;

  select sc.*, c.name as club_name into best_defense_row
  from season_clubs sc join clubs c on c.id = sc.club_id
  where sc.season_id = new.id
  order by sc.goals_against asc, sc.points desc limit 1;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.rank), '[]'::jsonb) into standings_json
  from (
    select row_number() over(order by sc.points desc, (sc.goals_for-sc.goals_against) desc, sc.goals_for desc) as rank,
      sc.club_id, c.name as club_name, sc.played, sc.wins, sc.draws, sc.losses,
      sc.goals_for, sc.goals_against, sc.points
    from season_clubs sc join clubs c on c.id = sc.club_id
    where sc.season_id = new.id
  ) x;

  select count(*), coalesce(sum(played),0)/2, coalesce(sum(goals_for),0)
  into club_count, match_count, goal_count
  from season_clubs where season_id = new.id;

  insert into season_archives(season_id, season_label, champion_club_id, champion_name, standings, total_clubs, total_matches, total_goals)
  values(new.id, season_name, champion_row.club_id, champion_row.club_name, standings_json, club_count, match_count, goal_count)
  on conflict(season_id) do nothing;

  if champion_row.club_id is not null then
    insert into season_awards(season_id, award_code, award_label, club_id, winner_name, value_label)
    values(new.id,'champion','Champion',champion_row.club_id,champion_row.club_name,champion_row.points || ' points')
    on conflict(season_id,award_code) do nothing;
  end if;

  if best_attack_row.club_id is not null then
    insert into season_awards(season_id, award_code, award_label, club_id, winner_name, value_label)
    values(new.id,'best_attack','Meilleure attaque',best_attack_row.club_id,best_attack_row.club_name,best_attack_row.goals_for || ' buts')
    on conflict(season_id,award_code) do nothing;
  end if;

  if best_defense_row.club_id is not null then
    insert into season_awards(season_id, award_code, award_label, club_id, winner_name, value_label)
    values(new.id,'best_defense','Meilleure défense',best_defense_row.club_id,best_defense_row.club_name,best_defense_row.goals_against || ' buts encaissés')
    on conflict(season_id,award_code) do nothing;
  end if;

  select p.*, c.name club_name into player_row
  from players p join clubs c on c.id=p.club_id join season_clubs sc on sc.club_id=p.club_id and sc.season_id=new.id
  order by p.overall desc, p.potential desc limit 1;
  if player_row.id is not null then
    insert into season_awards(season_id,award_code,award_label,player_id,club_id,winner_name,value_label)
    values(new.id,'player_of_season','Joueur de la saison',player_row.id,player_row.club_id,player_row.first_name||' '||player_row.last_name,'GEN '||player_row.overall)
    on conflict(season_id,award_code) do nothing;
  end if;

  select p.* into young_row from players p join season_clubs sc on sc.club_id=p.club_id and sc.season_id=new.id
  where p.age <= 21 order by p.overall desc, p.potential desc limit 1;
  if young_row.id is not null then
    insert into season_awards(season_id,award_code,award_label,player_id,club_id,winner_name,value_label)
    values(new.id,'best_young','Meilleur jeune',young_row.id,young_row.club_id,young_row.first_name||' '||young_row.last_name,young_row.age||' ans · GEN '||young_row.overall)
    on conflict(season_id,award_code) do nothing;
  end if;

  select p.* into keeper_row from players p join season_clubs sc on sc.club_id=p.club_id and sc.season_id=new.id
  where p.position='GK' order by p.overall desc, p.potential desc limit 1;
  if keeper_row.id is not null then
    insert into season_awards(season_id,award_code,award_label,player_id,club_id,winner_name,value_label)
    values(new.id,'best_goalkeeper','Meilleur gardien',keeper_row.id,keeper_row.club_id,keeper_row.first_name||' '||keeper_row.last_name,'GEN '||keeper_row.overall)
    on conflict(season_id,award_code) do nothing;
  end if;

  insert into season_best_xi(season_id,player_id,player_name,club_id,position,overall)
  select new.id,p.id,p.first_name||' '||p.last_name,p.club_id,p.position,p.overall
  from players p join season_clubs sc on sc.club_id=p.club_id and sc.season_id=new.id
  order by p.overall desc limit 11
  on conflict(season_id,player_id) do nothing;

  insert into club_honours(club_id,seasons_played,total_wins,total_draws,total_losses,total_goals_for,total_goals_against,league_titles)
  select sc.club_id,1,sc.wins,sc.draws,sc.losses,sc.goals_for,sc.goals_against,case when sc.club_id=champion_row.club_id then 1 else 0 end
  from season_clubs sc where sc.season_id=new.id
  on conflict(club_id) do update set
    seasons_played=club_honours.seasons_played+1,
    total_wins=club_honours.total_wins+excluded.total_wins,
    total_draws=club_honours.total_draws+excluded.total_draws,
    total_losses=club_honours.total_losses+excluded.total_losses,
    total_goals_for=club_honours.total_goals_for+excluded.total_goals_for,
    total_goals_against=club_honours.total_goals_against+excluded.total_goals_against,
    league_titles=club_honours.league_titles+excluded.league_titles,
    updated_at=now();

  insert into world_news(club_id,category,importance,title,content)
  values(champion_row.club_id,'competition',10,champion_row.club_name||' est sacré champion',champion_row.club_name||' termine la saison avec '||champion_row.points||' points.')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_archive_finished_season on seasons;
create trigger trg_archive_finished_season
after update of status on seasons
for each row execute function archive_finished_season();
