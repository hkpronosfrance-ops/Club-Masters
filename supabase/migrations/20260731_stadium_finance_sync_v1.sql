-- Journal financier détaillé du club.
create table if not exists club_finance_transactions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  category text not null check (category in (
    'match_bonus',
    'ticketing',
    'vip',
    'catering',
    'merchandise',
    'transfer',
    'infrastructure',
    'wages',
    'sponsor',
    'other'
  )),
  amount bigint not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_club_finance_transactions_club_created
  on club_finance_transactions(club_id, created_at desc);

create index if not exists idx_club_finance_transactions_match
  on club_finance_transactions(match_id)
  where match_id is not null;

-- Une ligne par catégorie et par match empêche un double crédit en cas de nouvelle requête.
create unique index if not exists idx_club_finance_transactions_unique_match_category
  on club_finance_transactions(club_id, match_id, category)
  where match_id is not null;

alter table club_finance_transactions enable row level security;
