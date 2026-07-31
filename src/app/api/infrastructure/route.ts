import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const FACILITIES = ["stadium", "training", "academy", "scouting", "medical"] as const;
type Facility = typeof FACILITIES[number];

const LABELS: Record<Facility, string> = {
  stadium: "Stade",
  training: "Centre d’entraînement",
  academy: "Académie",
  scouting: "Cellule de recrutement",
  medical: "Centre médical",
};

function projectCost(level: number) {
  return Math.round(750_000 * Math.pow(level, 1.85));
}

function projectDuration(level: number) {
  return Math.max(1, Math.ceil(level / 2));
}

async function userClubId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ?? null;
}

async function completeProjects(clubId: string, currentCycle: number) {
  const admin = createAdminClient();
  const { data: due } = await admin.from("infrastructure_projects").select("*").eq("club_id", clubId).eq("status", "active").lte("completes_cycle", currentCycle);
  for (const project of due ?? []) {
    const facility = project.facility as Facility;
    await admin.from("club_infrastructures").update({ [`${facility}_level`]: project.to_level, updated_at: new Date().toISOString() }).eq("club_id", clubId);
    await admin.from("infrastructure_projects").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", project.id);
    await admin.from("world_news").insert({ club_id: clubId, category: "club", importance: project.to_level >= 6 ? 3 : 2, title: `${LABELS[facility]} modernisé`, body: `Les travaux sont terminés. L’infrastructure atteint désormais le niveau ${project.to_level}.` });
  }
}

async function loadPayload(clubId: string) {
  const admin = createAdminClient();
  await admin.from("club_infrastructures").upsert({ club_id: clubId }, { onConflict: "club_id", ignoreDuplicates: true });
  const { data: cycle } = await admin.from("world_cycles").select("cycle_number").order("cycle_number", { ascending: false }).limit(1).maybeSingle();
  const currentCycle = Number(cycle?.cycle_number ?? 0);
  await completeProjects(clubId, currentCycle);
  const [{ data: infrastructure }, { data: projects }, { data: club }] = await Promise.all([
    admin.from("club_infrastructures").select("*").eq("club_id", clubId).single(),
    admin.from("infrastructure_projects").select("*").eq("club_id", clubId).order("created_at", { ascending: false }),
    admin.from("clubs").select("id,name,balance").eq("id", clubId).single(),
  ]);
  return { infrastructure, projects: projects ?? [], club, currentCycle, labels: LABELS };
}

export async function GET() {
  const clubId = await userClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  return NextResponse.json(await loadPayload(clubId));
}

export async function POST(request: Request) {
  const clubId = await userClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const facility = FACILITIES.includes(body.facility) ? body.facility as Facility : null;
  if (!facility) return NextResponse.json({ error: "Infrastructure invalide." }, { status: 400 });

  const admin = createAdminClient();
  const payload = await loadPayload(clubId);
  if (!payload.club) return NextResponse.json({ error: "Club introuvable." }, { status: 404 });

  const level = Number(payload.infrastructure?.[`${facility}_level`] ?? 1);
  if (level >= 10) return NextResponse.json({ error: "Cette infrastructure est déjà au niveau maximal." }, { status: 400 });
  const active = payload.projects.find((project: any) => project.facility === facility && project.status === "active");
  if (active) return NextResponse.json({ error: "Une amélioration est déjà en cours." }, { status: 409 });

  const nextLevel = level + 1;
  const cost = projectCost(nextLevel);
  const clubBalance = Number(payload.club.balance ?? 0);
  if (clubBalance < cost) return NextResponse.json({ error: "Trésorerie insuffisante." }, { status: 400 });
  const completesCycle = payload.currentCycle + projectDuration(nextLevel);

  await admin.from("clubs").update({ balance: clubBalance - cost }).eq("id", clubId);
  await admin.from("infrastructure_projects").insert({ club_id: clubId, facility, from_level: level, to_level: nextLevel, cost, started_cycle: payload.currentCycle, completes_cycle: completesCycle });
  await admin.from("world_news").insert({ club_id: clubId, category: "club", importance: nextLevel >= 6 ? 3 : 2, title: `${LABELS[facility]} : travaux lancés`, body: `Le club investit ${Math.round(cost / 1000)} k€ pour atteindre le niveau ${nextLevel}. Livraison prévue au cycle ${completesCycle}.` });

  return NextResponse.json(await loadPayload(clubId));
}
