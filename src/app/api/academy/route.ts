import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { academyIntakeSize, academyUpgradeCost, generateAcademyPlayer } from "@/lib/academyGenerator";

async function getUserClub() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) return null;
  const { data: club } = await admin.from("clubs").select("id,name,balance,academy_level,academy_next_intake_at").eq("id", profile.club_id).single();
  return club;
}

async function academyPayload(club:any) {
  const admin = createAdminClient();
  const { data: players } = await admin.from("academy_players").select("*").eq("club_id", club.id).eq("status", "academy").order("potential", { ascending: false });
  return { club, players: players ?? [], upgradeCost: academyUpgradeCost(club.academy_level ?? 1) };
}

export async function GET() {
  const club = await getUserClub();
  if (!club) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  return NextResponse.json(await academyPayload(club));
}

export async function POST(request:NextRequest) {
  const club = await getUserClub();
  if (!club) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const admin = createAdminClient();
  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (action === "intake") {
    const next = club.academy_next_intake_at ? new Date(club.academy_next_intake_at) : new Date(0);
    if (next.getTime() > Date.now()) return NextResponse.json({ error: "La prochaine promotion n'est pas encore disponible." }, { status: 400 });
    const { count } = await admin.from("academy_players").select("id", { count: "exact", head: true }).eq("club_id", club.id).eq("status", "academy");
    const capacity = 8 + (club.academy_level ?? 1) * 2;
    const available = Math.max(0, capacity - (count ?? 0));
    if (!available) return NextResponse.json({ error: "Le centre de formation est plein." }, { status: 400 });
    const amount = Math.min(available, academyIntakeSize(club.academy_level ?? 1));
    const rows = Array.from({ length: amount }, () => ({ ...generateAcademyPlayer(club.academy_level ?? 1), club_id: club.id }));
    const { error } = await admin.from("academy_players").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + 14);
    await admin.from("clubs").update({ academy_next_intake_at: nextDate.toISOString() }).eq("id", club.id);
    club.academy_next_intake_at = nextDate.toISOString();
  }

  if (action === "upgrade") {
    const level = club.academy_level ?? 1;
    if (level >= 10) return NextResponse.json({ error: "Le centre est déjà au niveau maximum." }, { status: 400 });
    const cost = academyUpgradeCost(level);
    if (club.balance < cost) return NextResponse.json({ error: "Solde insuffisant." }, { status: 400 });
    const { error } = await admin.from("clubs").update({ academy_level: level + 1, balance: club.balance - cost }).eq("id", club.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    club.academy_level = level + 1; club.balance -= cost;
  }

  if (action === "promote") {
    const { data: youth } = await admin.from("academy_players").select("*").eq("id", body.playerId).eq("club_id", club.id).eq("status", "academy").single();
    if (!youth) return NextResponse.json({ error: "Jeune introuvable." }, { status: 404 });
    const { data: player, error } = await admin.from("players").insert({
      club_id: club.id, first_name: youth.first_name, last_name: youth.last_name, age: youth.age, position: youth.position,
      overall: youth.overall, potential: youth.potential, pace: youth.pace, shooting: youth.shooting, passing: youth.passing,
      defending: youth.defending, physical: youth.physical, morale: 75, fatigue: 0, form: 50,
      value: Math.round(Math.pow(youth.overall, 3.2) * 1.8), wage: Math.max(800, youth.overall * 45),
      contract_until: `${new Date().getFullYear() + 4}-06-30`
    }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("academy_players").update({ status: "promoted", promoted_player_id: player.id }).eq("id", youth.id);
  }

  if (action === "release") {
    await admin.from("academy_players").update({ status: "released" }).eq("id", body.playerId).eq("club_id", club.id).eq("status", "academy");
  }

  const { data: freshClub } = await admin.from("clubs").select("id,name,balance,academy_level,academy_next_intake_at").eq("id", club.id).single();
  return NextResponse.json(await academyPayload(freshClub));
}
