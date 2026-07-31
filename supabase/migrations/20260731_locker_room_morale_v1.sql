alter table players add column if not exists morale int not null default 65 check (morale between 0 and 100);
alter table players add column if not exists squad_role text not null default 'rotation' check (squad_role in ('star','important','rotation','prospect','surplus'));
alter table players add column if not exists promised_role text check (promised_role in ('star','important','rotation','prospect'));
alter table players add column if not exists consecutive_benches int not null default 0;
alter table players add column if not exists happiness_reason text;
alter table players add column if not exists transfer_request boolean not null default false;
alter table players add column if not exists last_manager_talk_at timestamptz;

create table if not exists locker_room_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  event_type text not null check (event_type in ('role','praise','criticize','promise','complaint','transfer_request','team_meeting','match')),
  title text not null,
  body text not null,
  morale_delta int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_locker_room_events_club on locker_room_events(club_id, created_at desc);
create index if not exists idx_players_morale on players(club_id, morale);

alter table locker_room_events enable row level security;
create policy "locker_room_events_owner" on locker_room_events for select using (
  club_id in (select club_id from profiles where id = auth.uid())
);
