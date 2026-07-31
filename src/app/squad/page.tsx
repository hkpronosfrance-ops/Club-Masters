import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import SquadClient from "./SquadClient";

const POSITION_ORDER = ["GK", "DC", "DL", "DR", "MDC", "MC", "MOC", "AG", "AD", "BU"];

export default async function SquadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id) redirect("/");

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("club_id", profile.club_id)
    .order("overall", { ascending: false });

  const sorted = [...(players ?? [])].sort(
    (a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || b.overall - a.overall
  );

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <SquadClient players={sorted} />
    </div>
  );
}
