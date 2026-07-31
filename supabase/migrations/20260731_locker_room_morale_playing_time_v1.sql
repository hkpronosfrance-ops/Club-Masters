-- Vestiaire & Relations V2 : moral, statut et temps de jeu.
alter table players add column if not exists squad_role text not null default 'rotation';
alter table players add column if not exists promised_role text;
alter table players add column if not exists consecutive_benches integer not null default 0;
alter table players add column if not exists happiness_reason text;
alter table players add column if not exists transfer_request boolean not null default false;
alter table players add column if not exists last_manager_talk_at timestamptz;
alter table players add column if not exists coach_trust integer not null default 60;
alter table players add column if not exists contract_satisfaction integer not null default 60;
alter table players add column if not exists playing_time_satisfaction integer not null default 60;

alter table players drop constraint if exists players_squad_role_check;
alter table players add constraint players_squad_role_check
  check (squad_role in ('star','important','rotation','substitute','prospect','surplus'));

create table if not exists locker_room_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  event_type text not null,
  title text not null,
  body text not null,
  morale_delta integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_locker_room_events_club_created
  on locker_room_events(club_id, created_at desc);
create index if not exists idx_players_locker_room
  on players(club_id, transfer_request, morale asc);

alter table locker_room_events enable row level security;

create or replace function expected_playing_time_for_role(p_role text)
returns numeric
language sql
immutable
as $$
  select case p_role
    when 'star' then 0.85
    when 'important' then 0.70
    when 'rotation' then 0.45
    when 'substitute' then 0.20
    when 'prospect' then 0.10
    else 0.03
  end;
$$;

create or replace function refresh_player_morale_from_playing_time(p_season_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  s record;
  club_matches integer;
  actual_ratio numeric;
  expected_ratio numeric;
  gap numeric;
  time_score integer;
  next_morale integer;
  next_reason text;
  next_request boolean;
begin
  select * into p from players where id = p_player_id and is_retired = false;
  if not found then return; end if;

  select * into s from player_season_stats where season_id = p_season_id and player_id = p_player_id;
  select greatest(1, coalesce(max(played),0)) into club_matches
  from season_clubs where season_id = p_season_id and club_id = p.club_id;

  actual_ratio := least(1, coalesce(s.appearances,0)::numeric / club_matches::numeric);
  expected_ratio := expected_playing_time_for_role(p.squad_role);
  gap := actual_ratio - expected_ratio;
  time_score := greatest(0, least(100, round(60 + gap * 120)::integer));

  next_morale := greatest(0, least(100,
    round(
      time_score * 0.42 +
      coalesce(p.form,50) * 0.18 +
      (100 - coalesce(p.fatigue,0)) * 0.12 +
      coalesce(p.coach_trust,60) * 0.16 +
      coalesce(p.contract_satisfaction,60) * 0.12
    )::integer
  ));

  if gap <= -0.35 then next_reason := 'Très mécontent de son temps de jeu';
  elsif gap <= -0.18 then next_reason := 'Souhaite jouer davantage';
  elsif gap >= 0.18 then next_reason := 'Satisfait de la confiance du manager';
  else next_reason := 'Satisfait de son rôle actuel';
  end if;

  next_request := coalesce(p.transfer_request,false) or (next_morale <= 22 and gap <= -0.30);

  update players set
    playing_time_satisfaction = time_score,
    morale = next_morale,
    happiness_reason = next_reason,
    transfer_request = next_request,
    consecutive_benches = case when coalesce(s.appearances,0) < club_matches then consecutive_benches + 1 else 0 end
  where id = p_player_id;
end;
$$;
