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

  const [{ data: archives, error }, { data: honours }] = await Promise.all([
    admin.from("season_archives").select("*").order("archived_at", { ascending: false }),
    admin.from("club_honours").select("*").eq("club_id", profile.club_id).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seasonIds = (archives ?? []).map((item) => item.season_id);
  const [{ data: awards }, { data: bestXi }] = seasonIds.length
    ? await Promise.all([
        admin.from("season_awards").select("*").in("season_id", seasonIds).order("created_at", { ascending: true }),
        admin.from("season_best_xi").select("*").in("season_id", seasonIds).order("overall", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  return NextResponse.json({
    archives: (archives ?? []).map((archive) => ({
      ...archive,
      awards: (awards ?? []).filter((award) => award.season_id === archive.season_id),
      bestXi: (bestXi ?? []).filter((player) => player.season_id === archive.season_id),
    })),
    honours: honours ?? {
      league_titles: 0,
      seasons_played: 0,
      total_wins: 0,
      total_draws: 0,
      total_losses: 0,
      total_goals_for: 0,
      total_goals_against: 0,
    },
  });
}
