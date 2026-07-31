import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  const [{ data: records, error }, { data: honours }] = await Promise.all([
    admin.from("game_records").select("*").order("record_value", { ascending: false }),
    profile?.club_id ? admin.from("club_honours").select("*, club:clubs(name)").eq("club_id", profile.club_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: records ?? [], honours: honours ?? null, clubId: profile?.club_id ?? null });
}
