-- Supporters & Stade V1 — synchronisation automatique après chaque match enregistré.
-- Cette migration calcule l'affluence, l'ambiance et les revenus détaillés,
-- puis fait évoluer la satisfaction et la taille de la base de supporters.

create or replace function public.sync_home_match_supporters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  home_club clubs%rowtype;
  away_club clubs%rowtype;
  stadium_row stadiums%rowtype;
  fans fan_bases%rowtype;
  demand_ratio numeric;
  price_factor numeric;
  result_factor numeric;
  attendance_value integer;
  atmosphere_value integer;
  ticket_value bigint;
  vip_value bigint;
  catering_value bigint;
  merchandise_value bigint;
  satisfaction_delta integer;
  supporter_delta integer;
  reaction_sentiment text;
  reaction_message text;
begin
  select * into home_club from clubs where id = new.home_club_id;
  select * into away_club from clubs where id = new.away_club_id;

  if home_club.id is null then
    return new;
  end if;

  insert into stadiums (club_id, name)
  values (home_club.id, coalesce(home_club.name, 'Dynasty') || ' Arena')
  on conflict (club_id) do nothing;

  insert into fan_bases (club_id)
  values (home_club.id)
  on conflict (club_id) do nothing;

  select * into stadium_row from stadiums where club_id = home_club.id;
  select * into fans from fan_bases where club_id = home_club.id;

  price_factor := greatest(0.55, least(1.18, 1.08 - ((stadium_row.ticket_price - 24) / 110)));
  result_factor := case
    when new.home_score > new.away_score then 1.08
    when new.home_score = new.away_score then 1.00
    else 0.93
  end;

  demand_ratio :=
    0.42
    + (fans.loyalty::numeric / 500)
    + (fans.passion::numeric / 420)
    + (fans.satisfaction::numeric / 600)
    + (coalesce(home_club.reputation, 50)::numeric / 850)
    + (coalesce(away_club.reputation, 50)::numeric / 1200)
    + ((random() - 0.5) * 0.10);

  attendance_value := least(
    stadium_row.capacity,
    greatest(
      fans.season_ticket_holders,
      round(stadium_row.capacity * least(1.0, demand_ratio * price_factor * result_factor))::integer
    )
  );

  atmosphere_value := greatest(
    25,
    least(
      100,
      round(
        18
        + (attendance_value::numeric / greatest(stadium_row.capacity, 1)) * 48
        + fans.passion * 0.24
        + fans.satisfaction * 0.10
        + case when abs(new.home_score - new.away_score) <= 1 then 5 else 0 end
      )::integer
    )
  );

  ticket_value := round(attendance_value * stadium_row.ticket_price)::bigint;
  vip_value := round(attendance_value * (0.9 + stadium_row.vip_level * 0.42))::bigint;
  catering_value := round(attendance_value * (2.2 + stadium_row.catering_level * 0.75))::bigint;
  merchandise_value := round(attendance_value * (0.65 + stadium_row.shop_level * 0.48))::bigint;

  insert into match_attendance (
    club_id,
    match_id,
    attendance,
    atmosphere,
    ticket_revenue,
    vip_revenue,
    catering_revenue,
    merchandise_revenue
  ) values (
    home_club.id,
    new.id,
    attendance_value,
    atmosphere_value,
    ticket_value,
    vip_value,
    catering_value,
    merchandise_value
  )
  on conflict do nothing;

  if new.home_score > new.away_score then
    satisfaction_delta := case when new.home_score - new.away_score >= 3 then 6 else 4 end;
    supporter_delta := greatest(40, round(attendance_value * 0.006)::integer);
    reaction_sentiment := 'positive';
    reaction_message := case
      when new.home_score - new.away_score >= 3 then 'Quelle démonstration ! Le stade a vécu une soirée mémorable.'
      else 'Une victoire importante devant notre public. Cette équipe nous rend fiers.'
    end;
  elsif new.home_score = new.away_score then
    satisfaction_delta := 0;
    supporter_delta := greatest(5, round(attendance_value * 0.001)::integer);
    reaction_sentiment := 'neutral';
    reaction_message := 'Un résultat partagé. Il faudra être plus efficace au prochain match.';
  else
    satisfaction_delta := case when new.away_score - new.home_score >= 3 then -6 else -3 end;
    supporter_delta := -greatest(10, round(attendance_value * 0.0015)::integer);
    reaction_sentiment := 'negative';
    reaction_message := case
      when new.away_score - new.home_score >= 3 then 'Une lourde défaite à domicile. Les supporters attendent une réaction immédiate.'
      else 'Le public est déçu, mais il continuera de pousser l’équipe au prochain match.'
    end;
  end if;

  update fan_bases
  set
    supporters = greatest(1000, supporters + supporter_delta),
    satisfaction = greatest(0, least(100, satisfaction + satisfaction_delta)),
    local_popularity = greatest(0, least(100, local_popularity + case when new.home_score > new.away_score then 1 when new.home_score < new.away_score then -1 else 0 end)),
    updated_at = now()
  where club_id = home_club.id;

  insert into supporter_reactions (club_id, sentiment, message)
  values (home_club.id, reaction_sentiment, reaction_message);

  return new;
end;
$$;

drop trigger if exists trg_sync_home_match_supporters on matches;
create trigger trg_sync_home_match_supporters
after insert on matches
for each row
execute function public.sync_home_match_supporters();

create unique index if not exists idx_match_attendance_unique_match_club
  on match_attendance(match_id, club_id)
  where match_id is not null;
