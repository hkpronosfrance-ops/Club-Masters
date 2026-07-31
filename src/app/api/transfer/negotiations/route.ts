import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadStaffLevels, transferStaffEffects } from "@/lib/staffEffects";

async function getUserClub() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ?? null;
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function transactionError(message?: string) {
  if (message?.includes("INSUFFICIENT_FUNDS")) return { status: 400, message: "Budget insuffisant." };
  if (message?.includes("PLAYER_NO_LONGER_AVAILABLE")) return { status: 409, message: "Le joueur n’est plus disponible dans ce club." };
  if (message?.includes("NEGOTIATION_NOT_COMPLETABLE")) return { status: 409, message: "Cette négociation ne peut plus être finalisée." };
  if (message?.includes("NEGOTIATION_NOT_FOUND")) return { status: 404, message: "Négociation introuvable." };
  return { status: 500, message: "Le transfert n’a pas pu être finalisé." };
}

export async function GET() {
  const clubId = await getUserClub();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const admin = createAdminClient();
  const [{ data, error }, staffLevels] = await Promise.all([
    admin
      .from("transfer_negotiations")
      .select("*, player:players(id,first_name,last_name,position,overall,potential,value,wage), seller:clubs!transfer_negotiations_seller_club_id_fkey(id,name)")
      .eq("buyer_club_id", clubId)
      .order("created_at", { ascending: false }),
    loadStaffLevels(admin, clubId),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ negotiations: data ?? [], staffEffects: transferStaffEffects(staffLevels) });
}

export async function POST(req: Request) {
  const clubId = await getUserClub();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const playerId = typeof body?.playerId === "string" ? body.playerId : null;
  const transferFee = safeNumber(body?.transferFee, -1);
  const wageOffer = safeNumber(body?.wageOffer, -1);
  const signingBonus = safeNumber(body?.signingBonus, 0);
  const contractYears = Math.trunc(safeNumber(body?.contractYears, 3));

  if (!playerId || transferFee <= 0 || wageOffer <= 0 || signingBonus < 0 || contractYears < 1 || contractYears > 5) {
    return NextResponse.json({ error: "Offre invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: player }, { data: buyer }, staffLevels] = await Promise.all([
    admin.from("players").select("id,club_id,value,wage,is_listed,listed_price,overall,potential,age").eq("id", playerId).single(),
    admin.from("clubs").select("id,balance,reputation").eq("id", clubId).single(),
    loadStaffLevels(admin, clubId),
  ]);
  if (!player?.club_id || player.club_id === clubId) return NextResponse.json({ error: "Joueur indisponible." }, { status: 400 });

  const effects = transferStaffEffects(staffLevels);
  const effectiveSigningBonus = Math.round(signingBonus * (1 - effects.signingBonusReduction));
  if (!buyer || safeNumber(buyer.balance) < transferFee + effectiveSigningBonus) {
    return NextResponse.json({ error: "Budget insuffisant." }, { status: 400 });
  }

  const asking = Math.max(safeNumber(player.listed_price), safeNumber(player.value));
  const wageDemand = Math.max(
    safeNumber(player.wage, 1000),
    Math.round((safeNumber(player.value) / 260) * (1 + Math.max(0, 55 - safeNumber(buyer.reputation, 50)) / 100)),
  );
  const feeRatio = asking > 0 ? transferFee / asking + effects.feeAcceptanceBonus : 1;
  const wageRatio = wageOffer / Math.max(1, wageDemand) + effects.wageAcceptanceBonus;
  let status = "rejected";
  let clubResponse = "Le club vendeur juge l'offre trop faible.";
  let counterFee: number | null = null;
  let counterWage: number | null = null;

  if (feeRatio >= 0.98 && wageRatio >= 0.95) {
    status = "accepted";
    clubResponse = staffLevels.sporting_director > 0
      ? "Ton directeur sportif a obtenu un accord de principe. Tu peux finaliser le transfert."
      : "Accord de principe trouvé. Tu peux finaliser le transfert.";
  } else if (feeRatio >= 0.72 && wageRatio >= 0.75) {
    status = "countered";
    const reduction = 1 - effects.counterOfferReduction;
    counterFee = Math.round(Math.max(asking * 0.94, transferFee * 1.12) * reduction);
    counterWage = Math.round(Math.max(wageDemand * 0.95, wageOffer * 1.08) * reduction);
    clubResponse = staffLevels.sporting_director > 0
      ? "Le directeur sportif a réduit les exigences de la contre-offre."
      : "Le vendeur et l'agent ont formulé une contre-offre.";
  }

  const { data, error } = await admin.from("transfer_negotiations").insert({
    buyer_club_id: clubId,
    seller_club_id: player.club_id,
    player_id: player.id,
    transfer_fee: Math.round(transferFee),
    wage_offer: Math.round(wageOffer),
    signing_bonus: effectiveSigningBonus,
    contract_years: contractYears,
    status,
    club_response: clubResponse,
    counter_fee: counterFee,
    counter_wage: counterWage,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    negotiation: data,
    staffImpact: {
      sportingDirectorLevel: staffLevels.sporting_director,
      savedSigningBonus: signingBonus - effectiveSigningBonus,
      counterOfferReduction: effects.counterOfferReduction,
    },
  });
}

export async function PATCH(req: Request) {
  const clubId = await getUserClub();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const action = body?.action;
  if (!id || !["cancel", "complete"].includes(action)) return NextResponse.json({ error: "Action invalide." }, { status: 400 });

  const admin = createAdminClient();
  const { data: negotiation } = await admin.from("transfer_negotiations").select("id,status").eq("id", id).eq("buyer_club_id", clubId).maybeSingle();
  if (!negotiation) return NextResponse.json({ error: "Négociation introuvable." }, { status: 404 });

  if (action === "cancel") {
    if (["completed", "cancelled"].includes(negotiation.status)) return NextResponse.json({ error: "Cette négociation est déjà clôturée." }, { status: 409 });
    const { error } = await admin.from("transfer_negotiations").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id).eq("buyer_club_id", clubId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data, error } = await admin.rpc("complete_transfer_negotiation", {
    p_negotiation_id: id,
    p_buyer_club_id: clubId,
  });
  if (error) {
    const mapped = transactionError(error.message);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
  return NextResponse.json(data ?? { ok: true });
}
