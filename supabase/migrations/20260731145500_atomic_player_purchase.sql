-- Achat d'un joueur listé dans une seule transaction PostgreSQL.
-- La fonction verrouille le joueur et les clubs concernés afin d'éviter
-- les doubles achats et les soldes incohérents lors de requêtes simultanées.

create or replace function public.buy_listed_player(
  p_user_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer public.clubs%rowtype;
  v_seller public.clubs%rowtype;
  v_player public.players%rowtype;
  v_price bigint;
begin
  select * into v_buyer
  from public.clubs
  where owner_id = p_user_id
  for update;

  if not found then
    raise exception 'Aucun club';
  end if;

  select * into v_player
  from public.players
  where id = p_player_id
  for update;

  if not found or not v_player.is_listed or v_player.listed_price is null then
    raise exception 'Joueur indisponible';
  end if;

  if v_player.club_id = v_buyer.id then
    raise exception 'C''est déjà ton joueur';
  end if;

  v_price := v_player.listed_price;

  if v_price <= 0 then
    raise exception 'Prix invalide';
  end if;

  if v_buyer.balance < v_price then
    raise exception 'Budget insuffisant';
  end if;

  if v_player.club_id is not null then
    select * into v_seller
    from public.clubs
    where id = v_player.club_id
    for update;
  end if;

  update public.clubs
  set balance = balance - v_price
  where id = v_buyer.id;

  if v_seller.id is not null then
    update public.clubs
    set balance = balance + v_price
    where id = v_seller.id;
  end if;

  update public.players
  set club_id = v_buyer.id,
      is_listed = false,
      listed_price = null
  where id = v_player.id
    and is_listed = true;

  if not found then
    raise exception 'Joueur indisponible';
  end if;

  insert into public.transfers (player_id, from_club_id, to_club_id, fee)
  values (v_player.id, v_player.club_id, v_buyer.id, v_price);

  return jsonb_build_object(
    'success', true,
    'playerId', v_player.id,
    'buyerClubId', v_buyer.id,
    'sellerClubId', v_player.club_id,
    'fee', v_price
  );
end;
$$;

revoke all on function public.buy_listed_player(uuid, uuid) from public;
revoke all on function public.buy_listed_player(uuid, uuid) from anon;
revoke all on function public.buy_listed_player(uuid, uuid) from authenticated;
grant execute on function public.buy_listed_player(uuid, uuid) to service_role;
