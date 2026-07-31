alter table clubs add column if not exists academy_level int not null default 1 check (academy_level between 1 and 10);
alter table clubs add column if not exists academy_next_intake_at timestamptz default now();

create table if not exists academy_players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  nationality text not null,
  age int not null check (age between 15 and 18),
  position text not null,
  strong_foot text not null default 'Droit',
  height_cm int not null,
  weight_kg int not null,
  personality text not null,
  overall int not null,
  potential int not null,
  pace int not null,
  shooting int not null,
  passing int not null,
  defending int not null,
  physical int not null,
  scout_label text not null,
  scout_stars int not null check (scout_stars between 1 and 5),
  status text not null default 'academy' check (status in ('academy','promoted','released')),
  promoted_player_id uuid references players(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_academy_players_club on academy_players(club_id, status);
alter table academy_players enable row level security;

create policy "academy_select_own" on academy_players for select using (
  club_id in (select id from clubs where owner_id = auth.uid())
);
create policy "academy_insert_own" on academy_players for insert with check (
  club_id in (select id from clubs where owner_id = auth.uid())
);
create policy "academy_update_own" on academy_players for update using (
  club_id in (select id from clubs where owner_id = auth.uid())
);
