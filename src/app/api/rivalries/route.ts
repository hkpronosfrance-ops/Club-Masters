import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function clubIdForUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ?? null;
}

export async function GET() {
  const clubId = await clubIdForUser();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const admin = createAdminClient();
  const { data: rivalries, error } = await admin
    .from("club_rivalries")
    .select("*, club_a:clubs!club_rivalries_club_a_id_fkey(id,name,reputation), club_b:clubs!club_rivalries_club_b_id_fkey(id,name,reputation), last_winner:clubs!club_rivalries_last_winner_id_fkey(id,name)")
    .or(`club_a_id.eq.${clubId},club_b_id.eq.${clubId}`)
    .order("intensity", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: nextFixtures } = await admin
    .from("league_fixtures")
    .select("id,round,home_club_id,away_club_id,played,home:clubs!league_fixtures_home_club_id_fkey(id,name),away:clubs!league_fixtures_away_club_id_fkey(id,name)")
    .eq("played", false)
    .or(`home_club_id.eq.${clubId},away_club_id.eq.${clubId}`)
    .order("round", { ascending: true })
    .limit(8);

  const rivalryPairs = new Set((rivalries ?? []).map((item: any) => [item.club_a_id, item.club_b_id].sort().join(":")));
  const upcoming = (nextFixtures ?? []).map((fixture: any) => ({
    ...fixture,
    isRivalry: rivalryPairs.has([fixture.home_club_id, fixture.away_club_id].sort().join(":")),
  }));

  return NextResponse.json({ clubId, rivalries: rivalries ?? [], upcoming });
}
