import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function objectiveFor(reputation: number, clubCount: number) {
  if (reputation >= 80) return { code: "title", label: "Remporter le titre", target: 1 };
  if (reputation >= 65) return { code: "top3", label: "Terminer dans le top 3", target: Math.min(3, clubCount) };
  if (reputation >= 50) return { code: "top5", label: "Terminer dans le top 5", target: Math.min(5, clubCount) };
  return { code: "survival", label: "Éviter les deux dernières places", target: Math.max(1, clubCount - 2) };
}

async function userClub() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ?? null;
}

async function payload(clubId: string) {
  const admin = createAdminClient();
  const { data: club } = await admin.from("clubs").select("id,name,reputation,balance").eq("id", clubId).single();
  const { data: season } = await admin.from("seasons").select("*").or(`user_club_id.eq.${clubId},user_club_id.is.null`).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!season) return { club, season: null, standing: null };

  const { data: rows } = await admin.from("season_clubs").select("*,club:clubs(id,name)").eq("season_id", season.id);
  const standings = [...(rows ?? [])].sort((a: any, b: any) => b.points - a.points || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against) || b.goals_for - a.goals_for);
  const position = standings.findIndex((row: any) => row.club_id === clubId) + 1;
  const standing = standings.find((row: any) => row.club_id === clubId) ?? null;

  if (!season.objective_code && club) {
    const objective = objectiveFor(club.reputation ?? 50, standings.length || 10);
    const { data: updated } = await admin.from("seasons").update({ user_club_id: clubId, objective_code: objective.code, objective_label: objective.label, target_position: objective.target }).eq("id", season.id).select("*").single();
    return { club, season: updated, standing: standing ? { ...standing, position } : null };
  }

  return { club, season, standing: standing ? { ...standing, position } : null };
}

export async function GET() {
  const clubId = await userClub();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  return NextResponse.json(await payload(clubId));
}

export async function POST() {
  const clubId = await userClub();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const admin = createAdminClient();
  const current = await payload(clubId);
  if (!current.season || current.season.status !== "finished") return NextResponse.json({ error: "La saison actuelle doit être terminée." }, { status: 400 });

  const { data: active } = await admin.from("seasons").select("id").eq("status", "active").limit(1).maybeSingle();
  if (active) return NextResponse.json({ error: "Une saison active existe déjà." }, { status: 400 });

  return NextResponse.json({ ok: true, message: "La prochaine saison sera créée automatiquement à l'ouverture de la Ligue." });
}
