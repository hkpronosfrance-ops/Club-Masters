import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STYLES = ["offensive", "defensive", "youth", "discipline", "tactician"] as const;

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return { user, clubId: profile?.club_id ?? null, admin };
}

function rank(reputation: number) {
  if (reputation >= 90) return "Légende";
  if (reputation >= 75) return "Élite mondiale";
  if (reputation >= 55) return "International";
  if (reputation >= 35) return "National";
  if (reputation >= 18) return "Régional";
  return "Amateur";
}

async function ensureManager(userId: string, clubId: string | null, admin: ReturnType<typeof createAdminClient>) {
  let { data: manager } = await admin.from("manager_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (!manager) {
    const { data: inserted, error } = await admin.from("manager_profiles").insert({ user_id: userId, current_club_id: clubId }).select("*").single();
    if (error) throw error;
    manager = inserted;
    if (clubId) {
      const { data: club } = await admin.from("clubs").select("name").eq("id", clubId).single();
      await admin.from("manager_career_history").insert({ manager_id: manager.id, club_id: clubId, club_name: club?.name ?? "Club actuel" });
    }
  }
  return manager;
}

async function loadPayload(userId: string, clubId: string | null, admin: ReturnType<typeof createAdminClient>) {
  const manager = await ensureManager(userId, clubId, admin);
  const [{ data: currentClub }, { data: history }, { data: trophies }, { data: offers }] = await Promise.all([
    manager.current_club_id ? admin.from("clubs").select("id,name,reputation,balance").eq("id", manager.current_club_id).single() : Promise.resolve({ data: null }),
    admin.from("manager_career_history").select("*").eq("manager_id", manager.id).order("started_at", { ascending: false }),
    admin.from("manager_trophies").select("*").eq("manager_id", manager.id).order("won_at", { ascending: false }),
    admin.from("manager_job_offers").select("*,clubs(id,name,reputation,balance)").eq("manager_id", manager.id).order("created_at", { ascending: false }),
  ]);
  return { manager: { ...manager, rank: rank(Number(manager.reputation ?? 0)) }, currentClub, history: history ?? [], trophies: trophies ?? [], offers: offers ?? [] };
}

export async function GET() {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  return NextResponse.json(await loadPayload(ctx.user.id, ctx.clubId, ctx.admin));
}

export async function PATCH(request: Request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const manager = await ensureManager(ctx.user.id, ctx.clubId, ctx.admin);
  const body = await request.json().catch(() => ({}));
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 40) : manager.display_name;
  const nationality = typeof body.nationality === "string" ? body.nationality.trim().slice(0, 40) : manager.nationality;
  const age = Math.max(18, Math.min(90, Number(body.age ?? manager.age)));
  const style = STYLES.includes(body.managementStyle) ? body.managementStyle : manager.management_style;
  await ctx.admin.from("manager_profiles").update({ display_name: displayName || "Coach", nationality: nationality || "France", age, management_style: style, updated_at: new Date().toISOString() }).eq("id", manager.id);
  return NextResponse.json(await loadPayload(ctx.user.id, ctx.clubId, ctx.admin));
}

export async function POST(request: Request) {
  const ctx = await context();
  if (!ctx) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const manager = await ensureManager(ctx.user.id, ctx.clubId, ctx.admin);
  const body = await request.json().catch(() => ({}));

  if (body.action === "generate_offers") {
    const pending = await ctx.admin.from("manager_job_offers").select("id").eq("manager_id", manager.id).eq("status", "pending");
    if ((pending.data ?? []).length) return NextResponse.json({ error: "Des offres sont déjà en attente." }, { status: 409 });
    const minimum = Math.max(0, Number(manager.reputation ?? 0) - 18);
    const maximum = Math.min(100, Number(manager.reputation ?? 0) + 22);
    const { data: clubs } = await ctx.admin.from("clubs").select("id,name,reputation,balance").neq("id", manager.current_club_id ?? "00000000-0000-0000-0000-000000000000").gte("reputation", minimum).lte("reputation", maximum).limit(12);
    const candidates = [...(clubs ?? [])].sort(() => Math.random() - 0.5).slice(0, 3);
    const rows = candidates.map((club) => ({
      manager_id: manager.id,
      club_id: club.id,
      salary: Math.round(100_000 + Number(club.reputation ?? 20) * 18_000 + Math.random() * 250_000),
      contract_years: 2 + Math.floor(Math.random() * 3),
      objective: Number(club.reputation ?? 0) >= 70 ? "Se qualifier pour l’Europe" : Number(club.reputation ?? 0) >= 45 ? "Terminer dans la première moitié" : "Assurer le maintien",
    }));
    if (rows.length) await ctx.admin.from("manager_job_offers").insert(rows);
  }

  if (body.action === "respond_offer") {
    const offerId = typeof body.offerId === "string" ? body.offerId : null;
    const decision = body.decision === "accepted" ? "accepted" : body.decision === "rejected" ? "rejected" : null;
    if (!offerId || !decision) return NextResponse.json({ error: "Décision invalide." }, { status: 400 });
    const { data: offer } = await ctx.admin.from("manager_job_offers").select("*,clubs(id,name)").eq("id", offerId).eq("manager_id", manager.id).eq("status", "pending").single();
    if (!offer) return NextResponse.json({ error: "Offre introuvable." }, { status: 404 });
    await ctx.admin.from("manager_job_offers").update({ status: decision }).eq("id", offerId);
    if (decision === "accepted") {
      const today = new Date().toISOString().slice(0, 10);
      await ctx.admin.from("manager_career_history").update({ ended_at: today, reason_left: "Nouveau défi" }).eq("manager_id", manager.id).is("ended_at", null);
      await ctx.admin.from("manager_career_history").insert({ manager_id: manager.id, club_id: offer.club_id, club_name: offer.clubs?.name ?? "Nouveau club" });
      const contractUntil = new Date();
      contractUntil.setFullYear(contractUntil.getFullYear() + Number(offer.contract_years));
      await ctx.admin.from("manager_profiles").update({ current_club_id: offer.club_id, salary: offer.salary, contract_until: contractUntil.toISOString().slice(0, 10), updated_at: new Date().toISOString() }).eq("id", manager.id);
      await ctx.admin.from("profiles").update({ club_id: offer.club_id }).eq("id", ctx.user.id);
      await ctx.admin.from("world_news").insert({ club_id: offer.club_id, category: "club", importance: 4, title: `${offer.clubs?.name ?? "Un club"} tient son nouvel entraîneur`, body: `${manager.display_name} accepte un nouveau défi et signe un contrat de ${offer.contract_years} ans.` });
      await ctx.admin.from("manager_job_offers").update({ status: "rejected" }).eq("manager_id", manager.id).eq("status", "pending").neq("id", offerId);
    }
  }

  return NextResponse.json(await loadPayload(ctx.user.id, ctx.clubId, ctx.admin));
}
