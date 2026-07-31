import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES = ["star", "important", "rotation", "substitute", "prospect", "surplus"] as const;
const ROLE_EXPECTATION: Record<string, number> = { star: 85, important: 70, rotation: 45, substitute: 20, prospect: 10, surplus: 3 };
const TALKS = {
  praise: { delta: 7, trust: 4, title: "Félicitations individuelles", cooldown: 7 },
  criticize: { delta: -5, trust: -3, title: "Recadrage individuel", cooldown: 5 },
  promise: { delta: 4, trust: 5, title: "Promesse de temps de jeu", cooldown: 14 },
} as const;

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ? { admin, clubId: profile.club_id } : null;
}

async function payload(admin: any, clubId: string) {
  const { data: season } = await admin.from("seasons").select("id,name,status").eq("user_club_id", clubId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const [{ data: club }, { data: basePlayers }, { data: events }] = await Promise.all([
    admin.from("clubs").select("id,name").eq("id", clubId).single(),
    admin.from("players").select("id,first_name,last_name,age,position,overall,morale,form,fatigue,squad_role,promised_role,consecutive_benches,happiness_reason,transfer_request,last_manager_talk_at,coach_trust,contract_satisfaction,playing_time_satisfaction").eq("club_id", clubId).eq("is_retired", false).order("overall", { ascending: false }),
    admin.from("locker_room_events").select("*,player:players(first_name,last_name)").eq("club_id", clubId).order("created_at", { ascending: false }).limit(24),
  ]);

  if (season?.id) {
    await Promise.all((basePlayers ?? []).map((player: any) => admin.rpc("refresh_player_morale_from_playing_time", { p_season_id: season.id, p_player_id: player.id })));
  }

  const { data: players } = await admin.from("players").select("id,first_name,last_name,age,position,overall,morale,form,fatigue,squad_role,promised_role,consecutive_benches,happiness_reason,transfer_request,last_manager_talk_at,coach_trust,contract_satisfaction,playing_time_satisfaction").eq("club_id", clubId).eq("is_retired", false).order("overall", { ascending: false });
  const ids = (players ?? []).map((player: any) => player.id);
  const { data: stats } = season?.id && ids.length
    ? await admin.from("player_season_stats").select("player_id,appearances,starts,minutes").eq("season_id", season.id).in("player_id", ids)
    : { data: [] };
  const statsMap = new Map((stats ?? []).map((row: any) => [row.player_id, row]));
  const list = (players ?? []).map((player: any) => {
    const row: any = statsMap.get(player.id) ?? {};
    const expectedPercent = ROLE_EXPECTATION[player.squad_role] ?? 45;
    return { ...player, appearances: Number(row.appearances ?? 0), starts: Number(row.starts ?? 0), minutes: Number(row.minutes ?? 0), expectedPercent };
  });
  const averageMorale = list.length ? Math.round(list.reduce((sum: number, player: any) => sum + Number(player.morale ?? 65), 0) / list.length) : 0;
  const cohesion = list.length ? Math.round(list.reduce((sum: number, player: any) => sum + Number(player.coach_trust ?? 60), 0) / list.length) : 0;
  return { club, season, players: list, events: events ?? [], averageMorale, cohesion };
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  return NextResponse.json(await payload(ctx.admin, ctx.clubId));
}

export async function POST(request: Request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "set_role") {
    const role = ROLES.includes(body.role) ? body.role : null;
    if (!role || typeof body.playerId !== "string") return NextResponse.json({ error: "Rôle ou joueur invalide." }, { status: 400 });
    const { data: player } = await ctx.admin.from("players").select("*").eq("id", body.playerId).eq("club_id", ctx.clubId).single();
    if (!player) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });
    const expected = player.overall >= 82 ? "star" : player.overall >= 75 ? "important" : player.age <= 21 ? "prospect" : "rotation";
    const rank: Record<string, number> = { surplus: 0, prospect: 1, substitute: 2, rotation: 3, important: 4, star: 5 };
    const delta = Math.max(-10, Math.min(6, (rank[role] - rank[expected]) * 3));
    await ctx.admin.from("players").update({ squad_role: role, morale: Math.max(0, Math.min(100, Number(player.morale ?? 65) + delta)), coach_trust: Math.max(0, Math.min(100, Number(player.coach_trust ?? 60) + Math.sign(delta) * 2)), happiness_reason: delta < 0 ? "Déçu par son nouveau statut" : delta > 0 ? "Satisfait de la confiance du manager" : player.happiness_reason }).eq("id", player.id);
    await ctx.admin.from("locker_room_events").insert({ club_id: ctx.clubId, player_id: player.id, event_type: "role", title: "Nouveau rôle dans l’effectif", body: `${player.first_name} ${player.last_name} est désormais considéré comme ${role}.`, morale_delta: delta });
  } else if (action === "talk") {
    const talk = body.talk in TALKS ? body.talk as keyof typeof TALKS : null;
    if (!talk || typeof body.playerId !== "string") return NextResponse.json({ error: "Entretien invalide." }, { status: 400 });
    const { data: player } = await ctx.admin.from("players").select("*").eq("id", body.playerId).eq("club_id", ctx.clubId).single();
    if (!player) return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });
    const config = TALKS[talk];
    if (player.last_manager_talk_at && Date.now() - new Date(player.last_manager_talk_at).getTime() < config.cooldown * 86_400_000) return NextResponse.json({ error: "Un entretien a déjà eu lieu récemment avec ce joueur." }, { status: 429 });
    let delta = config.delta;
    if (talk === "praise" && Number(player.form ?? 50) < 45) delta = 2;
    if (talk === "criticize" && Number(player.form ?? 50) >= 65) delta = -9;
    const update: Record<string, unknown> = { morale: Math.max(0, Math.min(100, Number(player.morale ?? 65) + delta)), coach_trust: Math.max(0, Math.min(100, Number(player.coach_trust ?? 60) + config.trust)), last_manager_talk_at: new Date().toISOString(), happiness_reason: delta >= 0 ? "Encouragé par son manager" : "Froissé après un entretien" };
    if (talk === "promise") update.promised_role = player.squad_role === "surplus" ? "substitute" : player.squad_role;
    await ctx.admin.from("players").update(update).eq("id", player.id);
    await ctx.admin.from("locker_room_events").insert({ club_id: ctx.clubId, player_id: player.id, event_type: talk, title: config.title, body: `Entretien avec ${player.first_name} ${player.last_name}.`, morale_delta: delta });
  } else if (action === "team_meeting") {
    const { data: players } = await ctx.admin.from("players").select("id,morale,coach_trust").eq("club_id", ctx.clubId).eq("is_retired", false);
    await Promise.all((players ?? []).map((player: any) => ctx.admin.from("players").update({ morale: Math.min(100, Number(player.morale ?? 65) + 3), coach_trust: Math.min(100, Number(player.coach_trust ?? 60) + 2), happiness_reason: "Remobilisé par la réunion d’équipe" }).eq("id", player.id)));
    await ctx.admin.from("locker_room_events").insert({ club_id: ctx.clubId, event_type: "team_meeting", title: "Réunion d’équipe", body: "Le manager a remobilisé le vestiaire et rappelé les objectifs du club.", morale_delta: 3 });
  } else return NextResponse.json({ error: "Action inconnue." }, { status: 400 });

  return NextResponse.json(await payload(ctx.admin, ctx.clubId));
}
