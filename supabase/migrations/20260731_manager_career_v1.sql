create table if not exists manager_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  current_club_id uuid references clubs(id) on delete set null,
  display_name text not null default 'Coach',
  age int not null default 35 check (age between 18 and 90),
  nationality text not null default 'France',
  management_style text not null default 'tactician' check (management_style in ('offensive','defensive','youth','discipline','tactician')),
  reputation int not null default 10 check (reputation between 0 and 100),
  salary bigint not null default 120000,
  contract_until date not null default ((current_date + interval '2 years')::date),
  matches int not null default 0,
  wins int not null default 0,
  draws int not null default 0,
  losses int not null default 0,
  trophies int not null default 0,
  youth_promoted int not null default 0,
  career_score int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists manager_career_history (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references manager_profiles(id) on delete cascade,
  club_id uuid references clubs(id) on delete set null,
  club_name text not null,
  started_at date not null default current_date,
  ended_at date,
  matches int not null default 0,
  wins int not null default 0,
  draws int not null default 0,
  losses int not null default 0,
  trophies int not null default 0,
  reason_left text,
  created_at timestamptz not null default now()
);

create table if not exists manager_trophies (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references manager_profiles(id) on delete cascade,
  club_id uuid references clubs(id) on delete set null,
  trophy_type text not null,
  trophy_name text not null,
  season text not null,
  won_at timestamptz not null default now()
);

create table if not exists manager_job_offers (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references manager_profiles(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  salary bigint not null,
  contract_years int not null default 2 check (contract_years between 1 and 5),
  objective text not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create index if not exists idx_manager_history_manager on manager_career_history(manager_id, started_at desc);
create index if not exists idx_manager_trophies_manager on manager_trophies(manager_id, won_at desc);
create index if not exists idx_manager_offers_manager on manager_job_offers(manager_id, status, created_at desc);

alter table manager_profiles enable row level security;
alter table manager_career_history enable row level security;
alter table manager_trophies enable row level security;
alter table manager_job_offers enable row level security;

create policy "manager_profile_owner" on manager_profiles for select using (user_id = auth.uid());
create policy "manager_history_owner" on manager_career_history for select using (manager_id in (select id from manager_profiles where user_id = auth.uid()));
create policy "manager_trophies_owner" on manager_trophies for select using (manager_id in (select id from manager_profiles where user_id = auth.uid()));
create policy "manager_offers_owner" on manager_job_offers for select using (manager_id in (select id from manager_profiles where user_id = auth.uid()));
