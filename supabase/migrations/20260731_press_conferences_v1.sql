create table if not exists press_conferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  context text not null check (context in ('pre_match','post_match','club_event')),
  subject text not null,
  question text not null,
  answers jsonb not null default '[]'::jsonb,
  selected_answer text,
  tone text check (tone in ('calm','confident','protective','demanding','provocative')),
  morale_delta int not null default 0,
  reputation_delta int not null default 0,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_press_user_created on press_conferences(user_id, created_at desc);
create index if not exists idx_press_club_created on press_conferences(club_id, created_at desc);

alter table press_conferences enable row level security;
create policy "press_owner_read" on press_conferences for select using (user_id = auth.uid());
