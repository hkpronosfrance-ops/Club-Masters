import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getClubId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ?? null;
}

async function loadData(clubId: string) {
  const admin = createAdminClient();
  const [{ data: club }, { data: staff }, { data: candidates }] = await Promise.all([
    admin.from("clubs").select("id,name,balance").eq("id", clubId).single(),
    admin.from("club_staff").select("*").eq("club_id", clubId).eq("active", true).order("role"),
    admin.from("staff_candidates").select("*").eq("available", true).order("level", { ascending: false }),
  ]);
  return { club, staff: staff ?? [], candidates: candidates ?? [] };
}

export async function GET() {
  const clubId = await getClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  return NextResponse.json(await loadData(clubId));
}

export async function POST(request: Request) {
  const clubId = await getClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const candidateId = typeof body.candidateId === "string" ? body.candidateId : null;
  if (!candidateId) return NextResponse.json({ error: "Candidat invalide." }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: club }, { data: candidate }] = await Promise.all([
    admin.from("clubs").select("id,balance").eq("id", clubId).single(),
    admin.from("staff_candidates").select("*").eq("id", candidateId).eq("available", true).single(),
  ]);
  if (!club || !candidate) return NextResponse.json({ error: "Club ou candidat introuvable." }, { status: 404 });
  const balance = Number(club.balance ?? 0);
  if (balance < Number(candidate.signing_fee)) return NextResponse.json({ error: "Trésorerie insuffisante pour la prime de signature." }, { status: 400 });

  const { data: current } = await admin.from("club_staff").select("id").eq("club_id", clubId).eq("role", candidate.role).eq("active", true).maybeSingle();
  if (current) await admin.from("club_staff").update({ active: false }).eq("id", current.id);

  await admin.from("club_staff").insert({
    club_id: clubId,
    candidate_id: candidate.id,
    role: candidate.role,
    first_name: candidate.first_name,
    last_name: candidate.last_name,
    level: candidate.level,
    salary: candidate.salary,
    specialty: candidate.specialty,
  });
  await admin.from("staff_candidates").update({ available: false }).eq("id", candidate.id);
  await admin.from("clubs").update({ balance: balance - Number(candidate.signing_fee) }).eq("id", clubId);
  await admin.from("club_finance_transactions").insert({ club_id: clubId, category: "wages", amount: -Number(candidate.signing_fee), description: `Prime de signature — ${candidate.first_name} ${candidate.last_name}` });
  await admin.from("world_news").insert({ club_id: clubId, category: "club", importance: candidate.level >= 8 ? 3 : 2, title: "Un nouveau membre rejoint le staff", body: `${candidate.first_name} ${candidate.last_name} rejoint le club comme ${candidate.role}.` });

  return NextResponse.json(await loadData(clubId));
}
