alter table clubs add column if not exists last_training_at timestamptz;

create table if not exists training_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  program text not null,
  intensity text not null default 'normal',
  targeted_player_ids uuid[] not null default '{}',
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint training_program_check check (program in ('pace','shooting','passing','defending','physical')),
  constraint training_intensity_check check (intensity in ('light','normal','intense'))
);

create index if not exists idx_training_sessions_club on training_sessions(club_id, created_at desc);

alter table training_sessions enable row level security;
create policy "training_sessions_select_own" on training_sessions for select using (
  club_id in (select id from clubs where owner_id = auth.uid())
);
