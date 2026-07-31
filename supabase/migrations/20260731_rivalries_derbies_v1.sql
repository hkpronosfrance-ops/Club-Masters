create table if not exists club_rivalries (
  id uuid primary key default gen_random_uuid(),
  club_a_id uuid not null references clubs(id) on delete cascade,
  club_b_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  rivalry_type text not null default 'rivalry' check (rivalry_type in ('derby','historic','regional','title')),
  intensity integer not null default 60 check (intensity between 1 and 100),
  meetings integer not null default 0,
  club_a_wins integer not null default 0,
  club_b_wins integer not null default 0,
  draws integer not null default 0,
  last_winner_id uuid references clubs(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint club_rivalries_distinct_clubs check (club_a_id <> club_b_id)
);

create unique index if not exists idx_club_rivalries_pair
  on club_rivalries(least(club_a_id, club_b_id), greatest(club_a_id, club_b_id));
create index if not exists idx_club_rivalries_a on club_rivalries(club_a_id);
create index if not exists idx_club_rivalries_b on club_rivalries(club_b_id);

alter table club_rivalries enable row level security;

create or replace function public.register_rivalry_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rivalry club_rivalries%rowtype;
  winner uuid;
  home_is_a boolean;
begin
  select * into rivalry
  from club_rivalries
  where (club_a_id = new.home_club_id and club_b_id = new.away_club_id)
     or (club_a_id = new.away_club_id and club_b_id = new.home_club_id)
  limit 1;

  if rivalry.id is null then return new; end if;
  home_is_a := rivalry.club_a_id = new.home_club_id;
  winner := case when new.home_score > new.away_score then new.home_club_id when new.away_score > new.home_score then new.away_club_id else null end;

  update club_rivalries set
    meetings = meetings + 1,
    club_a_wins = club_a_wins + case when winner = club_a_id then 1 else 0 end,
    club_b_wins = club_b_wins + case when winner = club_b_id then 1 else 0 end,
    draws = draws + case when winner is null then 1 else 0 end,
    last_winner_id = coalesce(winner, last_winner_id),
    intensity = greatest(1, least(100, intensity + case when abs(new.home_score - new.away_score) <= 1 then 2 else 1 end)),
    updated_at = now()
  where id = rivalry.id;

  insert into supporter_reactions(club_id, sentiment, message)
  values
    (new.home_club_id,
      case when new.home_score > new.away_score then 'positive' when new.home_score = new.away_score then 'neutral' else 'negative' end,
      case when new.home_score > new.away_score then 'Victoire dans ' || rivalry.name || ' : une soirée que les supporters n’oublieront pas.' when new.home_score = new.away_score then rivalry.name || ' se termine sans vainqueur. La rivalité reste entière.' else 'Défaite dans ' || rivalry.name || '. Les supporters attendent déjà le match retour.' end),
    (new.away_club_id,
      case when new.away_score > new.home_score then 'positive' when new.home_score = new.away_score then 'neutral' else 'negative' end,
      case when new.away_score > new.home_score then 'Victoire à l’extérieur dans ' || rivalry.name || ' : un succès historique.' when new.home_score = new.away_score then rivalry.name || ' se termine sans vainqueur. La rivalité reste entière.' else 'Défaite dans ' || rivalry.name || '. Le prochain duel est déjà dans toutes les têtes.' end);

  return new;
end;
$$;

drop trigger if exists trg_register_rivalry_match on matches;
create trigger trg_register_rivalry_match
after insert on matches
for each row execute function public.register_rivalry_match();

create or replace function public.rivalry_match_modifier(home_id uuid, away_id uuid)
returns table(is_rivalry boolean, rivalry_name text, intensity integer, attendance_multiplier numeric, atmosphere_bonus integer, pressure_bonus integer)
language sql
stable
security definer
set search_path = public
as $$
  select true, r.name, r.intensity,
    1 + (r.intensity::numeric / 250),
    round(r.intensity * 0.22)::integer,
    round(r.intensity * 0.12)::integer
  from club_rivalries r
  where (r.club_a_id = home_id and r.club_b_id = away_id)
     or (r.club_a_id = away_id and r.club_b_id = home_id)
  limit 1;
$$;