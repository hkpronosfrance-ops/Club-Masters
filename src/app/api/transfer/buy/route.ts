import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const playerId = body?.playerId;

  if (typeof playerId !== "string" || !playerId) {
    return NextResponse.json({ error: "Identifiant joueur invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("buy_listed_player", {
    p_user_id: user.id,
    p_player_id: playerId,
  });

  if (error) {
    const knownErrors = [
      "Aucun club",
      "Joueur indisponible",
      "C'est déjà ton joueur",
      "Budget insuffisant",
      "Prix invalide",
    ];
    const message = knownErrors.find((known) => error.message.includes(known));

    return NextResponse.json(
      { error: message ?? "Impossible de finaliser le transfert" },
      { status: message ? 400 : 500 }
    );
  }

  return NextResponse.json(data ?? { success: true });
}
