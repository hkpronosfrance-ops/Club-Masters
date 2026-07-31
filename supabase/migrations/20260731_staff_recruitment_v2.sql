create table if not exists staff_candidates (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('sporting_director','scout','doctor','fitness_coach','video_analyst','academy_manager')),
  first_name text not null,
  last_name text not null,
  nationality text not null default 'France',
  level integer not null check (level between 1 and 10),
  salary bigint not null check (salary >= 0),
  signing_fee bigint not null default 0 check (signing_fee >= 0),
  specialty text,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists club_staff (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  candidate_id uuid references staff_candidates(id) on delete set null,
  role text not null check (role in ('sporting_director','scout','doctor','fitness_coach','video_analyst','academy_manager')),
  first_name text not null,
  last_name text not null,
  level integer not null check (level between 1 and 10),
  salary bigint not null check (salary >= 0),
  specialty text,
  hired_at timestamptz not null default now(),
  contract_until_cycle integer,
  active boolean not null default true
);

create unique index if not exists idx_club_staff_unique_active_role
  on club_staff(club_id, role)
  where active = true;

create index if not exists idx_staff_candidates_available_role
  on staff_candidates(role, available, level desc);

alter table staff_candidates enable row level security;
alter table club_staff enable row level security;

insert into staff_candidates (role, first_name, last_name, nationality, level, salary, signing_fee, specialty)
values
  ('sporting_director','Julien','Mercier','France',6,95000,220000,'Négociation'),
  ('sporting_director','Marco','Bellini','Italie',8,155000,450000,'Réseau international'),
  ('scout','Nicolas','Perrin','France',5,52000,90000,'Jeunes talents'),
  ('scout','Tiago','Mendes','Portugal',8,108000,260000,'Amérique du Sud'),
  ('doctor','Claire','Roux','France',7,88000,180000,'Prévention des blessures'),
  ('doctor','Anna','Keller','Allemagne',9,145000,390000,'Rééducation accélérée'),
  ('fitness_coach','Karim','Bensaïd','France',6,72000,130000,'Récupération'),
  ('fitness_coach','Pablo','Santos','Espagne',9,135000,350000,'Haute intensité'),
  ('video_analyst','Lucas','Fontaine','France',6,64000,110000,'Analyse adverse'),
  ('video_analyst','Milan','Petrovic','Serbie',8,112000,275000,'Transitions tactiques'),
  ('academy_manager','Éric','Lemoine','France',7,84000,170000,'Développement technique'),
  ('academy_manager','Johan','Van Dijk','Pays-Bas',9,142000,380000,'Formation totale')
on conflict do nothing;
