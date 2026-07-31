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
  await Promise.all([
    admin.from("stadiums").upsert({ club_id: clubId }, { onConflict: "club_id", ignoreDuplicates: true }),
    admin.from("fan_bases").upsert({ club_id: clubId }, { onConflict: "club_id", ignoreDuplicates: true }),
  ]);

  const [{ data: stadium }, { data: fans }, { data: attendance }, { data: reactions }] = await Promise.all([
    admin.from("stadiums").select("*").eq("club_id", clubId).single(),
    admin.from("fan_bases").select("*").eq("club_id", clubId).single(),
    admin.from("match_attendance").select("*").eq("club_id", clubId).order("created_at", { ascending: false }).limit(5),
    admin.from("supporter_reactions").select("*").eq("club_id", clubId).order("created_at", { ascending: false }).limit(8),
  ]);

  const estimatedAttendance = stadium && fans
    ? Math.min(stadium.capacity, Math.round(stadium.capacity * Math.min(0.98, 0.35 + fans.satisfaction / 200 + fans.local_popularity / 300)))
    : 0;
  const estimatedRevenue = stadium
    ? Math.round(estimatedAttendance * Number(stadium.ticket_price) + estimatedAttendance * (stadium.vip_level + stadium.catering_level + stadium.shop_level) * 1.8)
    : 0;

  return { stadium, fans, attendance: attendance ?? [], reactions: reactions ?? [], forecast: { attendance: estimatedAttendance, revenue: estimatedRevenue } };
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
