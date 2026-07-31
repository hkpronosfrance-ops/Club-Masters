import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) return NextResponse.json({ error: "Aucun club" }, { status: 400 });

  const { data: match } = await admin
    .from("matches")
    .select("*")
    .or(`home_club_id.eq.${profile.club_id},away_club_id.eq.${profile.club_id}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!match) return NextResponse.json({ match: null });

  const [{ data: home }, { data: away }] = await Promise.all([
    admin.from("clubs").select("id,name").eq("id", match.home_club_id).single(),
    admin.from("clubs").select("id,name").eq("id", match.away_club_id).single(),
  ]);

  return NextResponse.json({
    match: {
      ...match,
      home: home ?? { id: match.home_club_id, name: "Domicile" },
      away: away ?? { id: match.away_club_id, name: "Extérieur" },
    },
  });
}
