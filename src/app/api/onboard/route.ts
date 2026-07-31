import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSquad, generateAiClubName } from "@/lib/playerGenerator";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Si le profil a déjà un club, on ne refait rien (idempotent)
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile?.club_id) {
    return NextResponse.json({ clubId: existingProfile.club_id });
  }

  const { clubName, crest } = await req.json().catch(() => ({ clubName: null, crest: null }));
  const { name, short_name } = generateAiClubName();

  // Le profil doit exister AVANT le club, car clubs.owner_id référence profiles.id
  const { error: profileUpsertError } = await admin
    .from("profiles")
    .upsert({ id: user.id, username: user.email?.split("@")[0] ?? "manager" }, { onConflict: "id" });

  if (profileUpsertError) {
    return NextResponse.json({ error: profileUpsertError.message }, { status: 500 });
  }

  const { data: club, error: clubError } = await admin
    .from("clubs")
    .insert({
      owner_id: user.id,
      is_ai: false,
      name: clubName || name,
      short_name: (clubName || short_name).slice(0, 3).toUpperCase(),
      balance: 5_000_000,
      reputation: 50,
      formation: "4-3-3",
      tactic_style: "balanced",
      mentality: 50,
      crest_shape: crest?.shape || "shield",
      crest_icon: crest?.icon || "ball",
      primary_color: crest?.primaryColor || "#C81E3A",
      secondary_color: crest?.secondaryColor || "#FFFFFF",
    })
    .select()
    .single();

  if (clubError || !club) {
    return NextResponse.json({ error: clubError?.message }, { status: 500 });
  }

  const squad = generateSquad(58);
  const { error: playersError } = await admin.from("players").insert(
    squad.map((p) => ({ ...p, club_id: club.id }))
  );

  if (playersError) {
    return NextResponse.json({ error: playersError.message }, { status: 500 });
  }

  const { error: profileLinkError } = await admin
    .from("profiles")
    .update({ club_id: club.id })
    .eq("id", user.id);

  if (profileLinkError) {
    return NextResponse.json({ error: profileLinkError.message }, { status: 500 });
  }

  return NextResponse.json({ clubId: club.id });
}
