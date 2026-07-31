-- Records & Hall of Fame V1
create table if not exists game_records (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('world','club')),
  club_id uuid references clubs(id) on delete cascade,
  record_code text not null,
  record_label text not null,
  holder_type text not null check (holder_type in ('player','club')),
  holder_player_id uuid references players(id) on delete set null,
  holder_club_id uuid references clubs(id) on delete set null,
  holder_name text not null,
  record_value numeric not null default 0,
  value_label text,
  season_id uuid references seasons(id) on delete set null,
  achieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scope, club_id, record_code)
);

create table if not exists hall_of_fame_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references players(id) on delete cascade,
  club_id uuid references clubs(id) on delete set null,
  player_name text not null,
  position text,
  inducted_at timestamptz not null default now(),
  retirement_age integer,
  career_appearances integer not null default 0,
  career_goals integer not null default 0,
  career_assists integer not null default 0,
  career_clean_sheets integer not null default 0,
  individual_awards integer not null default 0,
  league_titles integer not null default 0,
  legend_score integer not null default 0,
  badges text[] not null default '{}',
  summary jsonb not null default '{}'::jsonb
);

create index if not exists idx_game_records_scope on game_records(scope, record_code);
create index if not exists idx_hof_legend_score on hall_of_fame_entries(legend_score desc);
alter table game_records enable row level security;
alter table hall_of_fame_entries enable row level security;

create or replace function refresh_records_and_hall_of_fame()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data record;
  title_row record;
  badge_list text[];
begin
  if new.status <> 'finished' or old.status = 'finished' then return new; end if;

  for row_data in
    select p.id, p.club_id, p.first_name || ' ' || p.last_name as player_name, p.position, p.age,
      coalesce(sum(ps.appearances),0)::int as apps,
      coalesce(sum(ps.goals),0)::int as goals,
      coalesce(sum(ps.assists),0)::int as assists,
      coalesce(sum(ps.clean_sheets),0)::int as clean_sheets,
      coalesce((select count(*) from season_awards sa where sa.player_id=p.id),0)::int as awards
    from players p
    left join player_season_stats ps on ps.player_id=p.id
    where p.is_retired=true
    group by p.id
  loop
    badge_list := array[]::text[];
    if row_data.goals >= 100 then badge_list := array_append(badge_list,'Roi des buteurs'); end if;
    if row_data.assists >= 75 then badge_list := array_append(badge_list,'Maître des passes'); end if;
    if row_data.clean_sheets >= 50 then badge_list := array_append(badge_list,'Mur infranchissable'); end if;
    if row_data.apps >= 300 then badge_list := array_append(badge_list,'Légende du club'); end if;
    if row_data.awards >= 3 then badge_list := array_append(badge_list,'Icône du championnat'); end if;

    insert into hall_of_fame_entries(player_id,club_id,player_name,position,retirement_age,career_appearances,career_goals,career_assists,career_clean_sheets,individual_awards,legend_score,badges)
    values(row_data.id,row_data.club_id,row_data.player_name,row_data.position,row_data.age,row_data.apps,row_data.goals,row_data.assists,row_data.clean_sheets,row_data.awards,
      row_data.apps + row_data.goals*4 + row_data.assists*3 + row_data.clean_sheets*3 + row_data.awards*25,badge_list)
    on conflict(player_id) do update set
      career_appearances=excluded.career_appearances, career_goals=excluded.career_goals,
      career_assists=excluded.career_assists, career_clean_sheets=excluded.career_clean_sheets,
      individual_awards=excluded.individual_awards, legend_score=excluded.legend_score,
      badges=excluded.badges;
  end loop;

  for row_data in
    select p.id, p.first_name || ' ' || p.last_name player_name, p.club_id,
      coalesce(sum(ps.goals),0) goals, coalesce(sum(ps.assists),0) assists,
      coalesce(sum(ps.appearances),0) appearances, coalesce(sum(ps.clean_sheets),0) clean_sheets
    from players p join player_season_stats ps on ps.player_id=p.id group by p.id
  loop
    insert into game_records(scope,record_code,record_label,holder_type,holder_player_id,holder_club_id,holder_name,record_value,value_label,season_id)
    values('world','career_goals','Meilleur buteur de l’histoire','player',row_data.id,row_data.club_id,row_data.player_name,row_data.goals,row_data.goals||' buts',new.id)
    on conflict(scope,club_id,record_code) do update set
      holder_player_id=case when excluded.record_value>game_records.record_value then excluded.holder_player_id else game_records.holder_player_id end,
      holder_club_id=case when excluded.record_value>game_records.record_value then excluded.holder_club_id else game_records.holder_club_id end,
      holder_name=case when excluded.record_value>game_records.record_value then excluded.holder_name else game_records.holder_name end,
      record_value=greatest(game_records.record_value,excluded.record_value),
      value_label=case when excluded.record_value>game_records.record_value then excluded.value_label else game_records.value_label end,
      season_id=case when excluded.record_value>game_records.record_value then excluded.season_id else game_records.season_id end,
      updated_at=now();

    insert into game_records(scope,record_code,record_label,holder_type,holder_player_id,holder_club_id,holder_name,record_value,value_label,season_id)
    values('world','career_assists','Meilleur passeur de l’histoire','player',row_data.id,row_data.club_id,row_data.player_name,row_data.assists,row_data.assists||' passes',new.id)
    on conflict(scope,club_id,record_code) do update set holder_player_id=case when excluded.record_value>game_records.record_value then excluded.holder_player_id else game_records.holder_player_id end,holder_club_id=case when excluded.record_value>game_records.record_value then excluded.holder_club_id else game_records.holder_club_id end,holder_name=case when excluded.record_value>game_records.record_value then excluded.holder_name else game_records.holder_name end,record_value=greatest(game_records.record_value,excluded.record_value),value_label=case when excluded.record_value>game_records.record_value then excluded.value_label else game_records.value_label end,season_id=case when excluded.record_value>game_records.record_value then excluded.season_id else game_records.season_id end,updated_at=now();
  end loop;

  for title_row in select ch.*, c.name club_name from club_honours ch join clubs c on c.id=ch.club_id loop
    insert into game_records(scope,record_code,record_label,holder_type,holder_club_id,holder_name,record_value,value_label,season_id)
    values('world','league_titles','Club le plus titré','club',title_row.club_id,title_row.club_name,title_row.league_titles,title_row.league_titles||' titres',new.id)
    on conflict(scope,club_id,record_code) do update set holder_club_id=case when excluded.record_value>game_records.record_value then excluded.holder_club_id else game_records.holder_club_id end,holder_name=case when excluded.record_value>game_records.record_value then excluded.holder_name else game_records.holder_name end,record_value=greatest(game_records.record_value,excluded.record_value),value_label=case when excluded.record_value>game_records.record_value then excluded.value_label else game_records.value_label end,updated_at=now();
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_refresh_records_hof on seasons;
create trigger trg_refresh_records_hof after update of status on seasons for each row execute function refresh_records_and_hall_of_fame();