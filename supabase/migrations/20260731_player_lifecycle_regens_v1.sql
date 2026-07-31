-- Monde Vivant V2 : vieillissement, progression/régression, retraites et regens.
alter table players add column if not exists is_retired boolean not null default false;
alter table players add column if not exists retired_at timestamptz;
alter table players add column if not exists regen_of_player_id uuid references players(id) on delete set null;

create table if not exists player_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id) on delete set null,
  player_id uuid references players(id) on delete set null,
  club_id uuid references clubs(id) on delete set null,
  event_type text not null check (event_type in ('aged','progressed','declined','retired','regen_created')),
  player_name text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_lifecycle_events_created on player_lifecycle_events(created_at desc);
create index if not exists idx_players_active_club on players(club_id, is_retired, overall desc);
alter table player_lifecycle_events enable row level security;

create or replace function process_player_lifecycle_after_season()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  new_age integer;
  delta integer;
  next_overall integer;
  retire_chance numeric;
  regen_first text;
  regen_last text;
  regen_overall integer;
  regen_potential integer;
  regen_id uuid;
begin
  if new.status <> 'finished' or old.status = 'finished' then
    return new;
  end if;

  for p in
    select * from players
    where is_retired = false
      and club_id in (select club_id from season_clubs where season_id = new.id)
  loop
    new_age := p.age + 1;
    delta := 0;

    if new_age <= 21 and p.overall < p.potential then
      delta := case when random() < 0.65 then 1 else 0 end;
    elsif new_age between 22 and 27 and p.overall < p.potential then
      delta := case when random() < 0.35 then 1 else 0 end;
    elsif new_age between 30 and 32 then
      delta := case when random() < 0.35 then -1 else 0 end;
    elsif new_age >= 33 then
      delta := -1 - case when random() < 0.25 then 1 else 0 end;
    end if;

    next_overall := greatest(35, least(p.potential, p.overall + delta));
    retire_chance := case
      when new_age >= 38 then 0.80
      when new_age = 37 then 0.55
      when new_age = 36 then 0.35
      when new_age = 35 then 0.18
      when new_age = 34 then 0.07
      else 0
    end;

    update players set
      age = new_age,
      overall = next_overall,
      pace = greatest(30, least(99, pace + case when delta > 0 then 1 when new_age >= 32 then -1 else 0 end)),
      shooting = greatest(30, least(99, shooting + case when delta <> 0 then delta else 0 end)),
      passing = greatest(30, least(99, passing + case when delta <> 0 then delta else 0 end)),
      defending = greatest(30, least(99, defending + case when delta <> 0 then delta else 0 end)),
      physical = greatest(30, least(99, physical + case when new_age >= 32 then -1 when delta > 0 then 1 else 0 end)),
      value = greatest(50000, round(value * case when delta > 0 then 1.10 when delta < 0 then 0.82 else 0.96 end))
    where id = p.id;

    insert into player_lifecycle_events(season_id,player_id,club_id,event_type,player_name,details)
    values(new.id,p.id,p.club_id,case when delta > 0 then 'progressed' when delta < 0 then 'declined' else 'aged' end,
      p.first_name||' '||p.last_name,jsonb_build_object('age',new_age,'overall_before',p.overall,'overall_after',next_overall));

    if random() < retire_chance then
      update players set is_retired=true, retired_at=now(), is_listed=false where id=p.id;
      insert into player_lifecycle_events(season_id,player_id,club_id,event_type,player_name,details)
      values(new.id,p.id,p.club_id,'retired',p.first_name||' '||p.last_name,jsonb_build_object('age',new_age,'overall',next_overall));

      regen_first := (array['Lucas','Noah','Enzo','Liam','Hugo','Adam','Nolan','Ethan','Sacha','Malo'])[1+floor(random()*10)::int];
      regen_last := (array['Martin','Bernard','Dubois','Robert','Thomas','Petit','Durand','Leroy','Moreau','Simon'])[1+floor(random()*10)::int];
      regen_overall := greatest(48, least(68, 48 + floor(random()*15)::int + floor(p.overall/20)::int));
      regen_potential := greatest(regen_overall+6, least(95, regen_overall + 10 + floor(random()*18)::int));

      insert into players(club_id,first_name,last_name,age,position,overall,potential,pace,shooting,passing,defending,physical,morale,fatigue,form,value,wage,contract_until,regen_of_player_id)
      values(p.club_id,regen_first,regen_last,16 + floor(random()*3)::int,p.position,regen_overall,regen_potential,
        greatest(45,regen_overall + floor(random()*12)::int - 5),greatest(35,regen_overall + floor(random()*12)::int - 8),
        greatest(40,regen_overall + floor(random()*12)::int - 5),greatest(35,regen_overall + floor(random()*12)::int - 8),
        greatest(40,regen_overall + floor(random()*12)::int - 5),72,0,50,
        round(power(regen_overall::numeric,3.1)*1.6),greatest(700,regen_overall*40),
        (extract(year from now())::int+4)||'-06-30',p.id)
      returning id into regen_id;

      insert into player_lifecycle_events(season_id,player_id,club_id,event_type,player_name,details)
      values(new.id,regen_id,p.club_id,'regen_created',regen_first||' '||regen_last,jsonb_build_object('overall',regen_overall,'potential',regen_potential));

      insert into world_news(club_id,category,importance,title,content)
      values(p.club_id,'player',7,p.first_name||' '||p.last_name||' prend sa retraite',regen_first||' '||regen_last||' rejoint le monde professionnel comme nouveau talent.');
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_player_lifecycle_after_season on seasons;
create trigger trg_player_lifecycle_after_season
after update of status on seasons
for each row execute function process_player_lifecycle_after_season();
