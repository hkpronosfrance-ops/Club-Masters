import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getUserClub() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ?? null;
}

export async function GET() {
  const clubId = await getUserClub();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("transfer_negotiations")
    .select("*, player:players(id,first_name,last_name,position,overall,potential,value,wage), seller:clubs!transfer_negotiations_seller_club_id_fkey(id,name)")
    .eq("buyer_club_id", clubId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ negotiations: data ?? [] });
}

export async function POST(req: Request) {
  const clubId = await getUserClub();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const playerId = body?.playerId;
  const transferFee = Number(body?.transferFee);
  const wageOffer = Number(body?.wageOffer);
  const signingBonus = Number(body?.signingBonus ?? 0);
  const contractYears = Number(body?.contractYears ?? 3);
  if (!playerId || transferFee <= 0 || wageOffer <= 0 || signingBonus < 0 || contractYears < 1 || contractYears > 5) {
    return NextResponse.json({ error: "Offre invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: player }, { data: buyer }] = await Promise.all([
    admin.from("players").select("id,club_id,value,wage,is_listed,listed_price,overall,potential,age").eq("id", playerId).single(),
    admin.from("clubs").select("id,balance,reputation").eq("id", clubId).single(),
  ]);
  if (!player?.club_id || player.club_id === clubId) return NextResponse.json({ error: "Joueur indisponible." }, { status: 400 });
  if (!buyer || buyer.balance < transferFee + signingBonus) return NextResponse.json({ error: "Budget insuffisant." }, { status: 400 });

  const asking = Math.max(Number(player.listed_price ?? 0), Number(player.value ?? 0));
  const wageDemand = Math.max(Number(player.wage ?? 1000), Math.round((Number(player.value ?? 0) / 260) * (1 + Math.max(0, 55 - Number(buyer.reputation ?? 50)) / 100)));
  const feeRatio = asking > 0 ? transferFee / asking : 1;
  const wageRatio = wageOffer / wageDemand;
  let status = "rejected";
  let clubResponse = "Le club vendeur juge l'offre trop faible.";
  let counterFee: number | null = null;
  let counterWage: number | null = null;

  if (feeRatio >= 0.98 && wageRatio >= 0.95) {
    status = "accepted";
    clubResponse = "Accord de principe trouvé. Tu peux finaliser le transfert.";
  } else if (feeRatio >= 0.72 && wageRatio >= 0.75) {
    status = "countered";
    counterFee = Math.round(Math.max(asking * 0.94, transferFee * 1.12));
    counterWage = Math.round(Math.max(wageDemand * 0.95, wageOffer * 1.08));
    clubResponse = "Le vendeur et l'agent ont formulé une contre-offre.";
  }

  const { data, error } = await admin.from("transfer_negotiations").insert({
    buyer_club_id: clubId,
    seller_club_id: player.club_id,
    player_id: player.id,
    transfer_fee: Math.round(transferFee),
    wage_offer: Math.round(wageOffer),
    signing_bonus: Math.round(signingBonus),
    contract_years: contractYears,
    status,
    club_response: clubResponse,
    counter_fee: counterFee,
    counter_wage: counterWage,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ negotiation: data });
}

export async function PATCH(req: Request) {
  const clubId = await getUserClub();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = body?.id;
  const action = body?.action;
  const admin = createAdminClient();
  const { data: negotiation } = await admin.from("transfer_negotiations").select("*").eq("id", id).eq("buyer_club_id", clubId).single();
  if (!negotiation) return NextResponse.json({ error: "Négociation introuvable." }, { status: 404 });
  if (action === "cancel") {
    await admin.from("transfer_negotiations").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true });
  }
  if (action !== "complete" || !["accepted", "countered"].includes(negotiation.status)) {
    return NextResponse.json({ error: "Action impossible." }, { status: 400 });
  }

  const fee = Number(negotiation.counter_fee ?? negotiation.transfer_fee);
  const wage = Number(negotiation.counter_wage ?? negotiation.wage_offer);
  const total = fee + Number(negotiation.signing_bonus ?? 0);
  const { data: buyer } = await admin.from("clubs").select("balance").eq("id", clubId).single();
  if (!buyer || buyer.balance < total) return NextResponse.json({ error: "Budget insuffisant." }, { status: 400 });
  const end = new Date();
  end.setFullYear(end.getFullYear() + Number(negotiation.contract_years));

  const { error: clubError } = await admin.from("clubs").update({ balance: buyer.balance - total }).eq("id", clubId);
  if (clubError) return NextResponse.json({ error: clubError.message }, { status: 500 });
  const { error: playerError } = await admin.from("players").update({ club_id: clubId, wage, contract_until: end.toISOString().slice(0, 10), is_listed: false, listed_price: null }).eq("id", negotiation.player_id);
  if (playerError) return NextResponse.json({ error: playerError.message }, { status: 500 });
  await admin.from("transfers").insert({ player_id: negotiation.player_id, from_club_id: negotiation.seller_club_id, to_club_id: clubId, fee });
  await admin.from("transfer_negotiations").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ ok: true });
}
