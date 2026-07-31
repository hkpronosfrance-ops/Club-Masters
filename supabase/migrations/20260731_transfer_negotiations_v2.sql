create table if not exists transfer_negotiations (
  id uuid primary key default gen_random_uuid(),
  buyer_club_id uuid not null references clubs(id) on delete cascade,
  seller_club_id uuid not null references clubs(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  transfer_fee bigint not null check (transfer_fee > 0),
  wage_offer bigint not null check (wage_offer > 0),
  signing_bonus bigint not null default 0 check (signing_bonus >= 0),
  contract_years int not null default 3 check (contract_years between 1 and 5),
  status text not null default 'pending' check (status in ('pending','countered','accepted','rejected','completed','cancelled')),
  club_response text,
  counter_fee bigint,
  counter_wage bigint,
  expires_at timestamptz not null default (now() + interval '3 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transfer_negotiations_buyer on transfer_negotiations(buyer_club_id, created_at desc);
create index if not exists idx_transfer_negotiations_player on transfer_negotiations(player_id, status);

alter table transfer_negotiations enable row level security;
create policy "negotiations_select_participants" on transfer_negotiations for select using (
  buyer_club_id in (select id from clubs where owner_id = auth.uid())
  or seller_club_id in (select id from clubs where owner_id = auth.uid())
);
