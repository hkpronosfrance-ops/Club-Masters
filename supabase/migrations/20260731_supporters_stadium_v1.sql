create table if not exists stadiums (
  club_id uuid primary key references clubs(id) on delete cascade,
  name text not null default 'Dynasty Arena',
  capacity integer not null default 18000 check (capacity between 1000 and 150000),
  pitch_quality integer not null default 1 check (pitch_quality between 1 and 10),
  vip_level integer not null default 1 check (vip_level between 1 and 10),
  shop_level integer not null default 1 check (shop_level between 1 and 10),
  catering_level integer not null default 1 check (catering_level between 1 and 10),
  parking_level integer not null default 1 check (parking_level between 1 and 10),
  ticket_price numeric(10,2) not null default 24 check (ticket_price between 5 and 500),
  updated_at timestamptz not null default now()
);

create table if not exists fan_bases (
  club_id uuid primary key references clubs(id) on delete cascade,
  supporters integer not null default 25000,
  season_ticket_holders integer not null default 4500,
  loyalty integer not null default 55 check (loyalty between 0 and 100),
  passion integer not null default 60 check (passion between 0 and 100),
  expectation integer not null default 50 check (expectation between 0 and 100),
  satisfaction integer not null default 55 check (satisfaction between 0 and 100),
  local_popularity integer not null default 55 check (local_popularity between 0 and 100),
  national_popularity integer not null default 25 check (national_popularity between 0 and 100),
  international_popularity integer not null default 5 check (international_popularity between 0 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists match_attendance (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  attendance integer not null,
  atmosphere integer not null check (atmosphere between 0 and 100),
  ticket_revenue bigint not null default 0,
  vip_revenue bigint not null default 0,
  catering_revenue bigint not null default 0,
  merchandise_revenue bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists supporter_reactions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  sentiment text not null check (sentiment in ('positive','neutral','negative')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_match_attendance_club_created on match_attendance(club_id, created_at desc);
create index if not exists idx_supporter_reactions_club_created on supporter_reactions(club_id, created_at desc);

alter table stadiums enable row level security;
alter table fan_bases enable row level security;
alter table match_attendance enable row level security;
alter table supporter_reactions enable row level security;
