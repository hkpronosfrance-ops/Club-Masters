import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function seed(id: string) { return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0); }
function seeded(id: string, salt: number) { const x = Math.sin(seed(id) * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); }

async function getClubId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return data?.club_id ?? null;
}

async function ensureStats(admin: any, clubId: string, matches: any[], players: any[]) {
  const starters = [...players].sort((a, b) => Number(b.overall ?? 0) - Number(a.overall ?? 0)).slice(0, 11);
  for (const match of matches) {
    const isHome = match.home_club_id === clubId;
    const goalsFor = Number(isHome ? match.home_score : match.away_score) || 0;
    const goalsAgainst = Number(isHome ? match.away_score : match.home_score) || 0;
    const { data: existingTeam } = await admin.from("match_team_stats").select("id").eq("match_id", match.id).eq("club_id", clubId).maybeSingle();
    if (!existingTeam) {
      const power = starters.reduce((sum, player) => sum + Number(player.overall ?? 60), 0) / Math.max(1, starters.length);
      const possession = clamp(44 + (power - 65) * .35 + seeded(match.id, 1) * 14, 31, 69);
      const shots = Math.max(goalsFor + 2, Math.round(7 + power / 12 + seeded(match.id, 2) * 7));
      const onTarget = clamp(Math.round(shots * (.35 + seeded(match.id, 3) * .24)), goalsFor, shots);
      await admin.from("match_team_stats").insert({ match_id: match.id, club_id: clubId, possession: possession.toFixed(2), shots, shots_on_target: onTarget, xg: clamp(goalsFor * .55 + shots * .075 + seeded(match.id, 4), .15, 5.5).toFixed(2), passes: Math.round(300 + possession * 3.2 + seeded(match.id, 5) * 120), pass_accuracy: clamp(72 + possession * .18 + seeded(match.id, 6) * 8, 69, 94).toFixed(2), corners: Math.round(seeded(match.id, 7) * 8), fouls: 7 + Math.round(seeded(match.id, 8) * 10), ppda: clamp(7 + (100 - possession) * .12 + seeded(match.id, 9) * 4, 6, 18).toFixed(2) });
    }
    const { data: existingPlayers } = await admin.from("player_match_stats").select("player_id").eq("match_id", match.id).eq("club_id", clubId);
    const existing = new Set((existingPlayers ?? []).map((row: any) => row.player_id));
    const rows = starters.filter((player) => !existing.has(player.id)).map((player, index) => {
      const attacking = ["ST", "LW", "RW", "CAM"].includes(player.position);
      const midfield = ["CM", "CDM", "CAM", "LM", "RM"].includes(player.position);
      const defender = ["CB", "LB", "RB", "LWB", "RWB"].includes(player.position);
      const isGoalkeeper = player.position === "GK";
      const goal = index < goalsFor ? 1 : 0;
      const assist = goalsFor > 0 && index >= goalsFor && index < goalsFor * 2 ? 1 : 0;
      const base = Number(player.overall ?? 60);
      const rating = clamp(5.7 + (goalsFor - goalsAgainst) * .18 + (base - 60) / 35 + goal * 1.05 + assist * .55 + seeded(match.id + player.id, 10) * .9, 4.5, 9.8);
      const shots = isGoalkeeper ? 0 : Math.round(seeded(match.id + player.id, 11) * (attacking ? 5 : 2));
      const passes = isGoalkeeper ? 20 + Math.round(seeded(player.id, 12) * 18) : 22 + Math.round(seeded(match.id + player.id, 13) * (midfield ? 55 : 35));
      return { match_id: match.id, club_id: clubId, player_id: player.id, minutes: 90, rating: rating.toFixed(2), goals: goal, assists: assist, shots, shots_on_target: Math.min(shots, goal + Math.round(shots * .4)), xg: (shots * .12 + goal * .3).toFixed(2), xa: (assist * .45 + seeded(player.id, 14) * .35).toFixed(2), passes, pass_accuracy: clamp(68 + base * .22 + seeded(player.id, 15) * 8, 68, 96).toFixed(2), key_passes: midfield || attacking ? Math.round(seeded(match.id + player.id, 16) * 4) : 0, tackles: defender || midfield ? Math.round(seeded(player.id, 17) * 6) : 0, interceptions: defender || midfield ? Math.round(seeded(match.id + player.id, 18) * 5) : 0, duels_won: Math.round(seeded(match.id + player.id, 19) * (defender ? 10 : 7)), saves: isGoalkeeper ? Math.max(0, Math.round(2 + seeded(match.id, 20) * 5 - goalsAgainst)) : 0 };
    });
    if (rows.length) await admin.from("player_match_stats").insert(rows);
  }
}

export async function GET() {
  const clubId = await getClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const admin = createAdminClient();
  const [{ data: club }, { data: players }, { data: matches }] = await Promise.all([
    admin.from("clubs").select("id,name").eq("id", clubId).single(),
    admin.from("players").select("id,first_name,last_name,position,age,overall,potential,form").eq("club_id", clubId),
    admin.from("matches").select("id,home_club_id,away_club_id,home_score,away_score,created_at,home:clubs!matches_home_club_id_fkey(name),away:clubs!matches_away_club_id_fkey(name)").or(`home_club_id.eq.${clubId},away_club_id.eq.${clubId}`).order("created_at", { ascending: false }).limit(20),
  ]);
  await ensureStats(admin, clubId, matches ?? [], players ?? []);
  const [{ data: teamStats }, { data: playerStats }] = await Promise.all([
    admin.from("match_team_stats").select("*").eq("club_id", clubId).order("created_at", { ascending: false }).limit(20),
    admin.from("player_match_stats").select("*,player:players(id,first_name,last_name,position,age,overall,potential,form)").eq("club_id", clubId).order("created_at", { ascending: false }).limit(500),
  ]);
  const grouped = new Map<string, any>();
  for (const row of playerStats ?? []) {
    const current = grouped.get(row.player_id) ?? { player: row.player, matches: 0, minutes: 0, goals: 0, assists: 0, xg: 0, xa: 0, shots: 0, keyPasses: 0, tackles: 0, interceptions: 0, duelsWon: 0, saves: 0, ratingTotal: 0 };
    current.matches++; current.minutes += row.minutes; current.goals += row.goals; current.assists += row.assists; current.xg += Number(row.xg); current.xa += Number(row.xa); current.shots += row.shots; current.keyPasses += row.key_passes; current.tackles += row.tackles; current.interceptions += row.interceptions; current.duelsWon += row.duels_won; current.saves += row.saves; current.ratingTotal += Number(row.rating); grouped.set(row.player_id, current);
  }
  const leaderboard = [...grouped.values()].map((row) => ({ ...row, averageRating: row.matches ? row.ratingTotal / row.matches : 0 })).sort((a, b) => b.averageRating - a.averageRating);
  const average = (key: string) => teamStats?.length ? teamStats.reduce((sum: number, row: any) => sum + Number(row[key] ?? 0), 0) / teamStats.length : 0;
  const summary = { matches: teamStats?.length ?? 0, possession: average("possession"), shots: average("shots"), shotsOnTarget: average("shots_on_target"), xg: average("xg"), passAccuracy: average("pass_accuracy"), ppda: average("ppda") };
  const insights = [summary.xg < 1.2 ? "La création d'occasions est insuffisante : augmente la présence dans la surface." : "L'équipe produit un volume d'occasions satisfaisant.", summary.passAccuracy < 80 ? "La précision de passe reste fragile sous pression." : "La circulation du ballon est l'un des points forts de l'équipe.", summary.ppda > 13 ? "Le pressing est peu intense : remonte le bloc ou augmente l'agressivité." : "Le pressing collectif est efficace."];
  return NextResponse.json({ club, summary, leaderboard, teamStats: teamStats ?? [], matches: matches ?? [], insights });
}