create table if not exists ai_transfer_events (
  id uuid primary key default gen_random_uuid(),
  cycle_number int not null,
  event_type text not null check (event_type in ('purchase','sale','renewal','listing')),
  buyer_club_id uuid references clubs(id) on delete set null,
  seller_club_id uuid references clubs(id) on delete set null,
  player_id uuid references players(id) on delete set null,
  transfer_fee bigint not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_transfer_events_cycle on ai_transfer_events(cycle_number desc, created_at desc);
create index if not exists idx_ai_transfer_events_player on ai_transfer_events(player_id, created_at desc);

alter table ai_transfer_events enable row level security;
create policy "ai_transfer_events_select_all" on ai_transfer_events for select using (true);
