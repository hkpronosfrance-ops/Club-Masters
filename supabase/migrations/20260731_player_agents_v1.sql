create table if not exists player_agents (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  nationality text not null default 'France',
  personality text not null check (personality in ('business','loyal','protective','ambitious','opportunist')),
  reputation int not null default 50 check (reputation between 0 and 100),
  difficulty int not null default 50 check (difficulty between 0 and 100),
  commission_rate numeric(5,2) not null default 8 check (commission_rate between 0 and 30),
  created_at timestamptz not null default now()
);

alter table players add column if not exists agent_id uuid references player_agents(id) on delete set null;

create table if not exists club_agent_relationships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  agent_id uuid not null references player_agents(id) on delete cascade,
  relationship int not null default 50 check (relationship between 0 and 100),
  successful_deals int not null default 0,
  failed_deals int not null default 0,
  updated_at timestamptz not null default now(),
  unique(club_id, agent_id)
);

create table if not exists agent_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  agent_id uuid not null references player_agents(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  message_type text not null check (message_type in ('renewal','playing_time','salary','transfer_interest','free_agent','warning')),
  subject text not null,
  body text not null,
  status text not null default 'unread' check (status in ('unread','read','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists agent_contract_negotiations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  agent_id uuid not null references player_agents(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  negotiation_type text not null check (negotiation_type in ('transfer','renewal')),
  salary bigint not null,
  signing_bonus bigint not null default 0,
  loyalty_bonus bigint not null default 0,
  appearance_bonus bigint not null default 0,
  goal_bonus bigint not null default 0,
  release_clause bigint,
  contract_years int not null default 3 check (contract_years between 1 and 5),
  promised_role text not null default 'rotation' check (promised_role in ('star','important','rotation','prospect')),
  status text not null default 'pending' check (status in ('pending','countered','accepted','rejected','cancelled')),
  agent_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_players_agent on players(agent_id);
create index if not exists idx_agent_messages_club on agent_messages(club_id, created_at desc);
create index if not exists idx_agent_negotiations_club on agent_contract_negotiations(club_id, created_at desc);

alter table player_agents enable row level security;
alter table club_agent_relationships enable row level security;
alter table agent_messages enable row level security;
alter table agent_contract_negotiations enable row level security;

create policy "agents_read" on player_agents for select using (true);
create policy "agent_relationship_owner_read" on club_agent_relationships for select using (club_id in (select id from clubs where owner_id = auth.uid()));
create policy "agent_messages_owner_read" on agent_messages for select using (club_id in (select id from clubs where owner_id = auth.uid()));
create policy "agent_negotiations_owner_read" on agent_contract_negotiations for select using (club_id in (select id from clubs where owner_id = auth.uid()));
