alter table players add column if not exists injured_until timestamptz;
alter table players add column if not exists injury_type text;
alter table clubs add column if not exists last_recovery_at timestamptz;

create index if not exists idx_players_injured_until on players(injured_until) where injured_until is not null;
