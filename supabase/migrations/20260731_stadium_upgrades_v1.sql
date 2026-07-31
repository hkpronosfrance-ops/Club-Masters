-- Supporters & Stade V1 — travaux et évolution du stade.

create table if not exists stadium_projects (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  facility text not null check (facility in ('capacity','pitch_quality','vip_level','shop_level','catering_level','parking_level')),
  from_level integer not null,
  to_level integer not null,
  capacity_gain integer not null default 0,
  cost bigint not null check (cost > 0),
  started_cycle integer not null default 0,
  completes_cycle integer not null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists idx_stadium_projects_one_active_facility
  on stadium_projects(club_id, facility)
  where status = 'active';

create index if not exists idx_stadium_projects_club_created
  on stadium_projects(club_id, created_at desc);

alter table stadium_projects enable row level security;

create or replace function public.complete_stadium_projects(p_club_id uuid, p_current_cycle integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  project stadium_projects%rowtype;
begin
  for project in
    select *
    from stadium_projects
    where club_id = p_club_id
      and status = 'active'
      and completes_cycle <= p_current_cycle
    for update
  loop
    if project.facility = 'capacity' then
      update stadiums
      set capacity = least(150000, capacity + project.capacity_gain), updated_at = now()
      where club_id = p_club_id;
    else
      execute format(
        'update stadiums set %I = least(10, %I + 1), updated_at = now() where club_id = $1',
        project.facility,
        project.facility
      ) using p_club_id;
    end if;

    update stadium_projects
    set status = 'completed', completed_at = now()
    where id = project.id;

    insert into world_news (club_id, category, importance, title, body)
    values (
      p_club_id,
      'club',
      case when project.to_level >= 7 then 3 else 2 end,
      case project.facility
        when 'capacity' then 'Extension du stade terminée'
        when 'pitch_quality' then 'Nouvelle pelouse opérationnelle'
        when 'vip_level' then 'Loges VIP modernisées'
        when 'shop_level' then 'Boutique officielle agrandie'
        when 'catering_level' then 'Espaces de restauration rénovés'
        else 'Parking du stade modernisé'
      end,
      case when project.facility = 'capacity'
        then 'Les travaux sont terminés. Le stade gagne ' || project.capacity_gain || ' places.'
        else 'Les travaux sont terminés. L’équipement atteint désormais le niveau ' || project.to_level || '.'
      end
    );
  end loop;
end;
$$;

create or replace function public.start_stadium_project(
  p_club_id uuid,
  p_facility text,
  p_current_cycle integer
)
returns stadium_projects
language plpgsql
security definer
set search_path = public
as $$
declare
  stadium_row stadiums%rowtype;
  club_row clubs%rowtype;
  current_level integer;
  next_level integer;
  project_cost bigint;
  project_duration integer;
  gain integer := 0;
  created_project stadium_projects%rowtype;
begin
  if p_facility not in ('capacity','pitch_quality','vip_level','shop_level','catering_level','parking_level') then
    raise exception 'Infrastructure invalide';
  end if;

  select * into stadium_row from stadiums where club_id = p_club_id for update;
  select * into club_row from clubs where id = p_club_id for update;

  if stadium_row.club_id is null or club_row.id is null then
    raise exception 'Club ou stade introuvable';
  end if;

  if exists (
    select 1 from stadium_projects
    where club_id = p_club_id and facility = p_facility and status = 'active'
  ) then
    raise exception 'Un projet est déjà en cours pour cet équipement';
  end if;

  if p_facility = 'capacity' then
    current_level := greatest(1, ceil(stadium_row.capacity / 10000.0)::integer);
    if stadium_row.capacity >= 150000 then raise exception 'Capacité maximale atteinte'; end if;
    next_level := current_level + 1;
    gain := least(10000, 150000 - stadium_row.capacity);
    project_cost := round(1200000 * power(next_level, 1.55))::bigint;
    project_duration := greatest(2, ceil(next_level / 2.0)::integer);
  else
    execute format('select ($1).%I', p_facility) into current_level using stadium_row;
    if current_level >= 10 then raise exception 'Niveau maximal atteint'; end if;
    next_level := current_level + 1;
    project_cost := round(
      case p_facility
        when 'pitch_quality' then 500000
        when 'vip_level' then 900000
        when 'shop_level' then 550000
        when 'catering_level' then 450000
        else 350000
      end * power(next_level, 1.65)
    )::bigint;
    project_duration := greatest(1, ceil(next_level / 3.0)::integer);
  end if;

  if coalesce(club_row.balance, 0) < project_cost then
    raise exception 'Trésorerie insuffisante';
  end if;

  update clubs set balance = balance - project_cost where id = p_club_id;

  insert into stadium_projects (
    club_id, facility, from_level, to_level, capacity_gain, cost, started_cycle, completes_cycle
  ) values (
    p_club_id, p_facility, current_level, next_level, gain, project_cost,
    p_current_cycle, p_current_cycle + project_duration
  ) returning * into created_project;

  insert into club_finance_transactions (club_id, category, amount, description)
  values (
    p_club_id,
    'infrastructure',
    -project_cost,
    case p_facility
      when 'capacity' then 'Extension de la capacité du stade'
      when 'pitch_quality' then 'Amélioration de la pelouse'
      when 'vip_level' then 'Modernisation des loges VIP'
      when 'shop_level' then 'Agrandissement de la boutique'
      when 'catering_level' then 'Rénovation de la restauration'
      else 'Modernisation du parking'
    end
  );

  insert into world_news (club_id, category, importance, title, body)
  values (
    p_club_id,
    'club',
    case when next_level >= 7 then 3 else 2 end,
    'Travaux lancés au stade',
    'Le club investit ' || round(project_cost / 1000.0) || ' k€ dans ses installations. Livraison prévue au cycle ' || (p_current_cycle + project_duration) || '.'
  );

  return created_project;
end;
$$;
