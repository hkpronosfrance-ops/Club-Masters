create or replace function sync_player_stat_awards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scorer record;
  passer record;
  rated record;
  young record;
  keeper record;
begin
  if new.status <> 'finished' or old.status = 'finished' then return new; end if;

  select l.* into scorer from player_season_leaderboard l where l.season_id = new.id order by l.goals desc, l.assists desc, l.average_rating desc limit 1;
  select l.* into passer from player_season_leaderboard l where l.season_id = new.id order by l.assists desc, l.goals desc, l.average_rating desc limit 1;
  select l.* into rated from player_season_leaderboard l where l.season_id = new.id and l.appearances >= 2 order by l.average_rating desc, l.goals desc, l.assists desc limit 1;
  select l.* into young from player_season_leaderboard l where l.season_id = new.id and l.age <= 21 order by l.average_rating desc, l.goals desc, l.assists desc limit 1;
  select l.* into keeper from player_season_leaderboard l where l.season_id = new.id and l.position = 'GK' order by l.clean_sheets desc, l.average_rating desc, l.saves desc limit 1;

  if scorer.player_id is not null then
    insert into season_awards(season_id,award_code,award_label,player_id,club_id,winner_name,value_label)
    values(new.id,'top_scorer','Meilleur buteur',scorer.player_id,scorer.club_id,scorer.first_name||' '||scorer.last_name,scorer.goals||' buts')
    on conflict(season_id,award_code) do update set player_id=excluded.player_id,club_id=excluded.club_id,winner_name=excluded.winner_name,value_label=excluded.value_label;
  end if;
  if passer.player_id is not null then
    insert into season_awards(season_id,award_code,award_label,player_id,club_id,winner_name,value_label)
    values(new.id,'top_assist','Meilleur passeur',passer.player_id,passer.club_id,passer.first_name||' '||passer.last_name,passer.assists||' passes')
    on conflict(season_id,award_code) do update set player_id=excluded.player_id,club_id=excluded.club_id,winner_name=excluded.winner_name,value_label=excluded.value_label;
  end if;
  if rated.player_id is not null then
    insert into season_awards(season_id,award_code,award_label,player_id,club_id,winner_name,value_label)
    values(new.id,'player_of_season','Joueur de la saison',rated.player_id,rated.club_id,rated.first_name||' '||rated.last_name,'Note '||rated.average_rating)
    on conflict(season_id,award_code) do update set player_id=excluded.player_id,club_id=excluded.club_id,winner_name=excluded.winner_name,value_label=excluded.value_label;
  end if;
  if young.player_id is not null then
    insert into season_awards(season_id,award_code,award_label,player_id,club_id,winner_name,value_label)
    values(new.id,'best_young','Meilleur jeune',young.player_id,young.club_id,young.first_name||' '||young.last_name,'Note '||young.average_rating)
    on conflict(season_id,award_code) do update set player_id=excluded.player_id,club_id=excluded.club_id,winner_name=excluded.winner_name,value_label=excluded.value_label;
  end if;
  if keeper.player_id is not null then
    insert into season_awards(season_id,award_code,award_label,player_id,club_id,winner_name,value_label)
    values(new.id,'best_goalkeeper','Meilleur gardien',keeper.player_id,keeper.club_id,keeper.first_name||' '||keeper.last_name,keeper.clean_sheets||' clean sheets')
    on conflict(season_id,award_code) do update set player_id=excluded.player_id,club_id=excluded.club_id,winner_name=excluded.winner_name,value_label=excluded.value_label;
  end if;

  delete from season_best_xi where season_id = new.id;
  insert into season_best_xi(season_id,player_id,player_name,club_id,position,overall)
  select new.id,l.player_id,l.first_name||' '||l.last_name,l.club_id,l.position,l.overall
  from player_season_leaderboard l where l.season_id=new.id
  order by l.average_rating desc,l.appearances desc limit 11;

  return new;
end;
$$;

drop trigger if exists trg_sync_player_stat_awards on seasons;
create trigger trg_sync_player_stat_awards
after update of status on seasons
for each row execute function sync_player_stat_awards();
