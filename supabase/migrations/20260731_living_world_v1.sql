create table if not exists world_cycles (
  id uuid primary key default gen_random_uuid(),
  cycle_number int not null unique,
  label text not null,
  processed_at timestamptz not null default now()
);

create table if not exists club_finance_entries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  cycle_number int not null,
  entry_type text not null check (entry_type in ('tv','sponsor','tickets','merchandising','wages','maintenance','transfer','prize')),
  amount bigint not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists world_news (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete set null,
  player_id uuid references players(id) on delete set null,
  category text not null check (category in ('finance','transfer','form','injury','academy','competition','club')),
  importance int not null default 1 check (importance between 1 and 5),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_world_news_created on world_news(created_at desc);
create index if not exists idx_world_news_club on world_news(club_id, created_at desc);
create index if not exists idx_finance_entries_club_cycle on club_finance_entries(club_id, cycle_number);

alter table world_cycles enable row level security;
alter table club_finance_entries enable row level security;
alter table world_news enable row level security;

create policy "world_cycles_read" on world_cycles for select using (true);
create policy "world_news_read" on world_news for select using (true);
create policy "club_finance_owner_read" on club_finance_entries for select using (
  club_id in (select id from clubs where owner_id = auth.uid())
);
