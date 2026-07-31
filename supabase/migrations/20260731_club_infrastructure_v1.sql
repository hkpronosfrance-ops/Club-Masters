create table if not exists club_infrastructures (
  club_id uuid primary key references clubs(id) on delete cascade,
  stadium_level int not null default 1 check (stadium_level between 1 and 10),
  training_level int not null default 1 check (training_level between 1 and 10),
  academy_level int not null default 1 check (academy_level between 1 and 10),
  scouting_level int not null default 1 check (scouting_level between 1 and 10),
  medical_level int not null default 1 check (medical_level between 1 and 10),
  updated_at timestamptz not null default now()
);

create table if not exists infrastructure_projects (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  facility text not null check (facility in ('stadium','training','academy','scouting','medical')),
  from_level int not null,
  to_level int not null,
  cost bigint not null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  started_cycle int not null default 0,
  completes_cycle int not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists idx_infrastructure_one_active
on infrastructure_projects(club_id, facility) where status = 'active';

alter table club_infrastructures enable row level security;
alter table infrastructure_projects enable row level security;

create policy "infrastructure_select_owner" on club_infrastructures for select using (
  club_id in (select id from clubs where owner_id = auth.uid())
);
create policy "projects_select_owner" on infrastructure_projects for select using (
  club_id in (select id from clubs where owner_id = auth.uid())
);
