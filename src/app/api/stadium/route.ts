import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const FACILITIES = ["capacity", "pitch_quality", "vip_level", "shop_level", "catering_level", "parking_level"] as const;
type Facility = typeof FACILITIES[number];

const LABELS: Record<Facility, string> = {
  capacity: "Capacité",
  pitch_quality: "Pelouse",
  vip_level: "Loges VIP",
  shop_level: "Boutique",
  catering_level: "Restauration",
  parking_level: "Parking",
};

async function getClubId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  return profile?.club_id ?? null;
}

function quote(facility: Facility, stadium: any) {
  if (facility === "capacity") {
    const level = Math.max(1, Math.ceil(Number(stadium?.capacity ?? 18000) / 10000));
    const gain = Math.min(10000, 150000 - Number(stadium?.capacity ?? 18000));
    return { level, nextLevel: level + 1, cost: Math.round(1_200_000 * Math.pow(level + 1, 1.55)), duration: Math.max(2, Math.ceil((level + 1) / 2)), gain };
  }
  const level = Number(stadium?.[facility] ?? 1);
  const base = facility === "pitch_quality" ? 500_000 : facility === "vip_level" ? 900_000 : facility === "shop_level" ? 550_000 : facility === "catering_level" ? 450_000 : 350_000;
  return { level, nextLevel: level + 1, cost: Math.round(base * Math.pow(level + 1, 1.65)), duration: Math.max(1, Math.ceil((level + 1) / 3)), gain: 0 };
}

async function loadData(clubId: string) {
  const admin = createAdminClient();
  await Promise.all([
    admin.from("stadiums").upsert({ club_id: clubId }, { onConflict: "club_id", ignoreDuplicates: true }),
    admin.from("fan_bases").upsert({ club_id: clubId }, { onConflict: "club_id", ignoreDuplicates: true }),
  ]);

  const { data: cycle } = await admin.from("world_cycles").select("cycle_number").order("cycle_number", { ascending: false }).limit(1).maybeSingle();
  const currentCycle = Number(cycle?.cycle_number ?? 0);
  await admin.rpc("complete_stadium_projects", { p_club_id: clubId, p_current_cycle: currentCycle });

  const [{ data: stadium }, { data: fans }, { data: attendance }, { data: reactions }, { data: projects }, { data: club }] = await Promise.all([
    admin.from("stadiums").select("*").eq("club_id", clubId).single(),
    admin.from("fan_bases").select("*").eq("club_id", clubId).single(),
    admin.from("match_attendance").select("*").eq("club_id", clubId).order("created_at", { ascending: false }).limit(5),
    admin.from("supporter_reactions").select("*").eq("club_id", clubId).order("created_at", { ascending: false }).limit(8),
    admin.from("stadium_projects").select("*").eq("club_id", clubId).order("created_at", { ascending: false }).limit(12),
    admin.from("clubs").select("id,balance").eq("id", clubId).single(),
  ]);

  const estimatedAttendance = stadium && fans
    ? Math.min(stadium.capacity, Math.round(stadium.capacity * Math.min(0.98, 0.35 + fans.satisfaction / 200 + fans.local_popularity / 300)))
    : 0;
  const estimatedRevenue = stadium
    ? Math.round(estimatedAttendance * Number(stadium.ticket_price) + estimatedAttendance * (stadium.vip_level + stadium.catering_level + stadium.shop_level) * 1.8)
    : 0;
  const offers = FACILITIES.map((facility) => ({ facility, label: LABELS[facility], ...quote(facility, stadium) }));

  return {
    stadium,
    fans,
    attendance: attendance ?? [],
    reactions: reactions ?? [],
    projects: projects ?? [],
    currentCycle,
    balance: Number(club?.balance ?? 0),
    offers,
    forecast: { attendance: estimatedAttendance, revenue: estimatedRevenue },
  };
}

export async function GET() {
  const clubId = await getClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  return NextResponse.json(await loadData(clubId));
}

export async function PATCH(request: Request) {
  const clubId = await getClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const ticketPrice = Number(body.ticketPrice);
  const stadiumName = typeof body.stadiumName === "string" ? body.stadiumName.trim().slice(0, 60) : "";
  if (!Number.isFinite(ticketPrice) || ticketPrice < 5 || ticketPrice > 500 || stadiumName.length < 3) {
    return NextResponse.json({ error: "Nom ou prix invalide." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin.from("stadiums").update({ name: stadiumName, ticket_price: ticketPrice, updated_at: new Date().toISOString() }).eq("club_id", clubId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(await loadData(clubId));
}

export async function POST(request: Request) {
  const clubId = await getClubId();
  if (!clubId) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const facility = FACILITIES.includes(body.facility) ? body.facility as Facility : null;
  if (!facility) return NextResponse.json({ error: "Projet invalide." }, { status: 400 });

  const admin = createAdminClient();
  const { data: cycle } = await admin.from("world_cycles").select("cycle_number").order("cycle_number", { ascending: false }).limit(1).maybeSingle();
  const currentCycle = Number(cycle?.cycle_number ?? 0);
  const { error } = await admin.rpc("start_stadium_project", {
    p_club_id: clubId,
    p_facility: facility,
    p_current_cycle: currentCycle,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(await loadData(clubId));
}
