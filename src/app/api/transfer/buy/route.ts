import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { playerId } = await req.json();
  const admin = createAdminClient();

  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) return NextResponse.json({ error: "Aucun club" }, { status: 400 });

  const { data: buyerClub } = await admin.from("clubs").select("*").eq("id", profile.club_id).single();
  const { data: player } = await admin.from("players").select("*").eq("id", playerId).single();

  if (!player || !player.is_listed) {
    return NextResponse.json({ error: "Joueur indisponible" }, { status: 400 });
  }
  if (player.club_id === buyerClub!.id) {
    return NextResponse.json({ error: "C'est déjà ton joueur" }, { status: 400 });
  }
  if (buyerClub!.balance < player.listed_price) {
    return NextResponse.json({ error: "Budget insuffisant" }, { status: 400 });
  }

  const { data: sellerClub } = await admin.from("clubs").select("*").eq("id", player.club_id).single();

  // Transaction simplifiée (MVP) : 3 updates séquentiels
  await admin.from("clubs").update({ balance: buyerClub!.balance - player.listed_price }).eq("id", buyerClub!.id);
  if (sellerClub) {
    await admin
      .from("clubs")
      .update({ balance: sellerClub.balance + player.listed_price })
      .eq("id", sellerClub.id);
  }
  await admin
    .from("players")
    .update({ club_id: buyerClub!.id, is_listed: false, listed_price: null })
    .eq("id", playerId);

  await admin.from("transfers").insert({
    player_id: playerId,
    from_club_id: player.club_id,
    to_club_id: buyerClub!.id,
    fee: player.listed_price,
  });

  return NextResponse.json({ success: true });
}
