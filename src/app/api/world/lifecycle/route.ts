import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) return NextResponse.json({ error: "Aucun club." }, { status: 400 });

  const [{ data: events, error }, { data: retired }, { data: regens }] = await Promise.all([
    admin.from("player_lifecycle_events").select("*").order("created_at", { ascending: false }).limit(150),
    admin.from("players").select("id,first_name,last_name,age,position,overall,retired_at,club:clubs(name)").eq("is_retired", true).order("retired_at", { ascending: false }).limit(40),
    admin.from("players").select("id,first_name,last_name,age,position,overall,potential,club_id,club:clubs(name),regen_of_player_id").not("regen_of_player_id", "is", null).eq("is_retired", false).order("created_at", { ascending: false }).limit(40),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    events: events ?? [],
    retired: retired ?? [],
    regens: regens ?? [],
    userClubId: profile.club_id,
  });
}
