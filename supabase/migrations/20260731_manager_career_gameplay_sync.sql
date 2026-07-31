create or replace function sync_manager_career_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  manager_row manager_profiles%rowtype;
  manager_score int;
  opponent_rep int;
  club_rep int;
  result_text text;
  rep_delta int;
begin
  if new.played is not true or coalesce(old.played, false) is true then
    return new;
  end if;

  for manager_row in
    select * from manager_profiles
    where current_club_id in (new.home_club_id, new.away_club_id)
  loop
    if manager_row.current_club_id = new.home_club_id then
      manager_score := coalesce(new.home_score, 0);
      select coalesce(reputation, 50) into opponent_rep from clubs where id = new.away_club_id;
    else
      manager_score := coalesce(new.away_score, 0);
      select coalesce(reputation, 50) into opponent_rep from clubs where id = new.home_club_id;
    end if;

    select coalesce(reputation, 50) into club_rep from clubs where id = manager_row.current_club_id;

    if new.home_score = new.away_score then
      result_text := 'draw';
      rep_delta := case when opponent_rep - club_rep >= 5 then 1 else 0 end;
    elsif (manager_row.current_club_id = new.home_club_id and new.home_score > new.away_score)
       or (manager_row.current_club_id = new.away_club_id and new.away_score > new.home_score) then
      result_text := 'win';
      rep_delta := greatest(1, round(2 + greatest(-12, least(12, opponent_rep - club_rep))::numeric / 8)::int);
    else
      result_text := 'loss';
      rep_delta := case when opponent_rep - club_rep <= -6 then -2 else -1 end;
    end if;

    update manager_profiles
    set matches = matches + 1,
        wins = wins + case when result_text = 'win' then 1 else 0 end,
        draws = draws + case when result_text = 'draw' then 1 else 0 end,
        losses = losses + case when result_text = 'loss' then 1 else 0 end,
        reputation = greatest(0, least(100, reputation + rep_delta)),
        career_score = greatest(0,
          (wins + case when result_text = 'win' then 1 else 0 end) * 3
          + (draws + case when result_text = 'draw' then 1 else 0 end)
          + trophies * 35
          + greatest(0, least(100, reputation + rep_delta)) * 2
          - (losses + case when result_text = 'loss' then 1 else 0 end)
        ),
        updated_at = now()
    where id = manager_row.id;

    update manager_career_history
    set matches = matches + 1,
        wins = wins + case when result_text = 'win' then 1 else 0 end,
        draws = draws + case when result_text = 'draw' then 1 else 0 end,
        losses = losses + case when result_text = 'loss' then 1 else 0 end
    where id = (
      select id from manager_career_history
      where manager_id = manager_row.id
        and club_id = manager_row.current_club_id
        and ended_at is null
      order by started_at desc
      limit 1
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_sync_manager_career_match on league_fixtures;
create trigger trg_sync_manager_career_match
after update of played, home_score, away_score on league_fixtures
for each row execute function sync_manager_career_match();

create or replace function sync_manager_league_trophy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  champion_id uuid;
  manager_row manager_profiles%rowtype;
  season_label text;
begin
  if new.status <> 'finished' or old.status = 'finished' then
    return new;
  end if;

  select club_id into champion_id
  from season_clubs
  where season_id = new.id
  order by points desc, (goals_for - goals_against) desc, goals_for desc
  limit 1;

  if champion_id is null then return new; end if;
  season_label := extract(year from coalesce(new.finished_at, now()))::text;

  for manager_row in select * from manager_profiles where current_club_id = champion_id loop
    if not exists (
      select 1 from manager_trophies
      where manager_id = manager_row.id
        and trophy_type = 'league'
        and season = season_label
    ) then
      insert into manager_trophies(manager_id, club_id, trophy_type, trophy_name, season)
      values(manager_row.id, champion_id, 'league', 'Championnat national', season_label);

      update manager_profiles
      set trophies = trophies + 1,
          reputation = least(100, reputation + 8),
          career_score = career_score + 51,
          updated_at = now()
      where id = manager_row.id;

      update manager_career_history
      set trophies = trophies + 1
      where id = (
        select id from manager_career_history
        where manager_id = manager_row.id and club_id = champion_id and ended_at is null
        order by started_at desc limit 1
      );

      insert into world_news(club_id, category, importance, title, body)
      values(champion_id, 'competition', 5, 'Le manager entre dans l’histoire', manager_row.display_name || ' remporte le championnat national.');
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_sync_manager_league_trophy on seasons;
create trigger trg_sync_manager_league_trophy
after update of status on seasons
for each row execute function sync_manager_league_trophy();
