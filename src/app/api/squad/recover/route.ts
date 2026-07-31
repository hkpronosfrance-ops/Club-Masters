import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const RECOVERY_COOLDOWN_HOURS = 18;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) return NextResponse.json({ error: "Aucun club" }, { status: 400 });

  const { data: club } = await admin.from("clubs").select("last_recovery_at").eq("id", profile.club_id).single();
  const lastRecovery = club?.last_recovery_at ? new Date(club.last_recovery_at).getTime() : 0;
  const elapsed = Date.now() - lastRecovery;
  const cooldown = RECOVERY_COOLDOWN_HOURS * 60 * 60 * 1000;
  if (lastRecovery && elapsed < cooldown) {
    const remainingHours = Math.ceil((cooldown - elapsed) / 3_600_000);
    return NextResponse.json({ error: `Le prochain repos collectif sera disponible dans environ ${remainingHours} h.` }, { status: 429 });
  }

  const { data: players } = await admin.from("players").select("id,fatigue,morale").eq("club_id", profile.club_id);
  for (const player of players ?? []) {
    const recovery = player.fatigue >= 75 ? 24 : player.fatigue >= 45 ? 18 : 12;
    await admin.from("players").update({
      fatigue: Math.max(0, player.fatigue - recovery),
      morale: Math.min(100, player.morale + 2),
    }).eq("id", player.id);
  }

  await admin.from("clubs").update({ last_recovery_at: new Date().toISOString() }).eq("id", profile.club_id);
  return NextResponse.json({ recovered: players?.length ?? 0, cooldownHours: RECOVERY_COOLDOWN_HOURS });
}
