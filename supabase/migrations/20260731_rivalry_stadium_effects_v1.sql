create or replace function public.apply_rivalry_stadium_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rivalry club_rivalries%rowtype;
  stadium_capacity integer;
  multiplier numeric;
  updated_attendance integer;
begin
  select * into rivalry
  from club_rivalries
  where (club_a_id = new.home_club_id and club_b_id = new.away_club_id)
     or (club_a_id = new.away_club_id and club_b_id = new.home_club_id)
  limit 1;
  if rivalry.id is null then return new; end if;

  select capacity into stadium_capacity from stadiums where club_id = new.home_club_id;
  multiplier := 1 + rivalry.intensity::numeric / 250;

  select least(coalesce(stadium_capacity, attendance), round(attendance * multiplier)::integer)
  into updated_attendance
  from match_attendance where match_id = new.id and club_id = new.home_club_id;

  update match_attendance
  set attendance = updated_attendance,
      atmosphere = least(100, atmosphere + round(rivalry.intensity * 0.22)::integer),
      ticket_revenue = round(ticket_revenue * updated_attendance::numeric / greatest(attendance, 1))::bigint,
      vip_revenue = round(vip_revenue * updated_attendance::numeric / greatest(attendance, 1))::bigint,
      catering_revenue = round(catering_revenue * updated_attendance::numeric / greatest(attendance, 1))::bigint,
      merchandise_revenue = round(merchandise_revenue * updated_attendance::numeric / greatest(attendance, 1))::bigint
  where match_id = new.id and club_id = new.home_club_id;

  insert into world_news(club_id, category, importance, title, body)
  values(new.home_club_id, 'match', 3, rivalry.name || ' enflamme la ville', 'Le derby a attiré une affluence exceptionnelle et placé les joueurs sous une pression maximale.');
  return new;
end;
$$;

drop trigger if exists zz_trg_apply_rivalry_stadium_effects on matches;
create trigger zz_trg_apply_rivalry_stadium_effects
after insert on matches
for each row execute function public.apply_rivalry_stadium_effects();
