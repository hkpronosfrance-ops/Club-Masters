import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) return NextResponse.json({ error: "Aucun club." }, { status: 400 });

  const url = new URL(request.url);
  const requestedSeason = url.searchParams.get("seasonId");
  const { data: seasons } = await admin.from("seasons").select("id,name,status,created_at").order("created_at", { ascending: false }).limit(20);
  const seasonId = requestedSeason && (seasons ?? []).some((season) => season.id === requestedSeason)
    ? requestedSeason
    : (seasons ?? []).find((season) => season.status === "active")?.id ?? seasons?.[0]?.id;
  if (!seasonId) return NextResponse.json({ seasons: [], seasonId: null, rows: [] });

  const { data, error } = await admin.from("player_season_leaderboard").select("*").eq("season_id", seasonId).order("goals", { ascending: false }).order("assists", { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seasons: seasons ?? [], seasonId, rows: data ?? [], userClubId: profile.club_id });
}
