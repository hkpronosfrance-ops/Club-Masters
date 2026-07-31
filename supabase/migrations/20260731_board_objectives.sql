alter table seasons
  add column if not exists user_club_id uuid references clubs(id) on delete set null,
  add column if not exists objective_code text,
  add column if not exists objective_label text,
  add column if not exists target_position int,
  add column if not exists board_confidence int not null default 60,
  add column if not exists final_position int,
  add column if not exists final_bonus bigint not null default 0,
  add column if not exists objective_met boolean,
  add column if not exists season_summary jsonb,
  add column if not exists reward_claimed boolean not null default false;

alter table seasons drop constraint if exists seasons_board_confidence_check;
alter table seasons add constraint seasons_board_confidence_check check (board_confidence between 0 and 100);

create index if not exists idx_seasons_user_club on seasons(user_club_id, created_at desc);
