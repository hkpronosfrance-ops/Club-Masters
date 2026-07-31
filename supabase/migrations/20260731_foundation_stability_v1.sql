-- Dynasty Eleven Foundation — stabilisation technique V1
-- Sécurise la finalisation des transferts dans une transaction PostgreSQL
-- et ajoute les index utilisés par les écrans les plus consultés.

create or replace function public.complete_transfer_negotiation(
  p_negotiation_id uuid,
  p_buyer_club_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negotiation public.transfer_negotiations%rowtype;
  v_player public.players%rowtype;
  v_buyer public.clubs%rowtype;
  v_seller public.clubs%rowtype;
  v_fee bigint;
  v_wage bigint;
  v_bonus bigint;
  v_total bigint;
  v_contract_until date;
begin
  select * into v_negotiation
  from public.transfer_negotiations
  where id = p_negotiation_id
    and buyer_club_id = p_buyer_club_id
  for update;

  if not found then
    raise exception 'NEGOTIATION_NOT_FOUND';
  end if;

  if v_negotiation.status not in ('accepted', 'countered') then
    raise exception 'NEGOTIATION_NOT_COMPLETABLE';
  end if;

  select * into v_player
  from public.players
  where id = v_negotiation.player_id
  for update;

  if not found or v_player.club_id is distinct from v_negotiation.seller_club_id then
    raise exception 'PLAYER_NO_LONGER_AVAILABLE';
  end if;

  select * into v_buyer
  from public.clubs
  where id = p_buyer_club_id
  for update;

  select * into v_seller
  from public.clubs
  where id = v_negotiation.seller_club_id
  for update;

  if v_buyer.id is null or v_seller.id is null then
    raise exception 'CLUB_NOT_FOUND';
  end if;

  v_fee := greatest(0, coalesce(v_negotiation.counter_fee, v_negotiation.transfer_fee, 0));
  v_wage := greatest(1, coalesce(v_negotiation.counter_wage, v_negotiation.wage_offer, 1));
  v_bonus := greatest(0, coalesce(v_negotiation.signing_bonus, 0));
  v_total := v_fee + v_bonus;

  if coalesce(v_buyer.balance, 0) < v_total then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  v_contract_until := current_date + make_interval(years => greatest(1, least(5, coalesce(v_negotiation.contract_years, 3))));

  update public.clubs
  set balance = balance - v_total
  where id = v_buyer.id;

  update public.clubs
  set balance = balance + v_fee
  where id = v_seller.id;

  update public.players
  set club_id = v_buyer.id,
      wage = v_wage,
      contract_until = v_contract_until,
      is_listed = false,
      listed_price = null
  where id = v_player.id;

  insert into public.transfers (player_id, from_club_id, to_club_id, fee)
  values (v_player.id, v_seller.id, v_buyer.id, v_fee);

  update public.transfer_negotiations
  set status = 'completed',
      updated_at = now()
  where id = v_negotiation.id;

  return jsonb_build_object(
    'ok', true,
    'player_id', v_player.id,
    'fee', v_fee,
    'wage', v_wage,
    'contract_until', v_contract_until
  );
end;
$$;

revoke all on function public.complete_transfer_negotiation(uuid, uuid) from public;
grant execute on function public.complete_transfer_negotiation(uuid, uuid) to service_role;

-- Index des requêtes fréquentes. Les créations sont idempotentes.
create index if not exists idx_players_club_overall on public.players (club_id, overall desc);
create index if not exists idx_players_club_contract on public.players (club_id, contract_until);
create index if not exists idx_players_transfer_listed on public.players (is_listed, listed_price) where is_listed = true;
create index if not exists idx_matches_home_played on public.matches (home_club_id, played_at desc);
create index if not exists idx_matches_away_played on public.matches (away_club_id, played_at desc);
create index if not exists idx_league_fixtures_season_round on public.league_fixtures (season_id, round, played);
create index if not exists idx_season_clubs_ranking on public.season_clubs (season_id, points desc, goals_for desc);
create index if not exists idx_transfer_negotiations_buyer_status on public.transfer_negotiations (buyer_club_id, status, created_at desc);
create index if not exists idx_world_news_created on public.world_news (created_at desc);
create index if not exists idx_training_sessions_club_created on public.training_sessions (club_id, created_at desc);
