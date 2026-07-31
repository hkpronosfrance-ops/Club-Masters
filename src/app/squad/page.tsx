import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";

const POSITION_ORDER = ["GK", "DC", "DL", "DR", "MDC", "MC", "MOC", "AG", "AD", "BU"];

function overallColor(overall: number) {
  if (overall >= 75) return "text-gold";
  if (overall >= 60) return "text-pitchgreen";
  if (overall >= 45) return "text-zinc-300";
  return "text-muted";
}

export default async function SquadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
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
    <div className="min-h-screen pitch-bg pb-24 md:pb-8">
      <Nav />
      <main className="max-w-4xl mx-auto px-5 py-8">
        <h1 className="font-display text-2xl font-semibold mb-1">Effectif</h1>
        <p className="text-sm text-muted mb-6">{players?.length ?? 0} joueurs sous contrat</p>

        <div className="bg-pitch-900 border border-pitch-700 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[2.5rem_1fr_3rem_3rem_3rem_4rem] gap-2 px-4 py-2 text-[11px] uppercase tracking-wide text-muted border-b border-pitch-700 font-mono">
            <span>Pos</span>
            <span>Nom</span>
            <span className="text-center">Âge</span>
            <span className="text-center">Note</span>
            <span className="text-center">Forme</span>
            <span className="text-right">Fatigue</span>
          </div>
          {sorted.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[2.5rem_1fr_3rem_3rem_3rem_4rem] gap-2 px-4 py-2.5 items-center border-b border-pitch-800 last:border-0 hover:bg-pitch-800/60 text-sm"
            >
              <span className="text-carmine-light font-mono text-xs font-bold">{p.position}</span>
              <span className="truncate">
                {p.first_name} {p.last_name}
              </span>
              <span className="text-center font-mono text-muted">{p.age}</span>
              <span className={`text-center font-mono font-bold ${overallColor(p.overall)}`}>{p.overall}</span>
              <span className="text-center font-mono text-muted">{p.form}</span>
              <div className="flex items-center justify-end">
                <div className="w-12 h-1.5 bg-pitch-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${p.fatigue > 66 ? "bg-carmine" : p.fatigue > 33 ? "bg-gold" : "bg-pitchgreen"}`}
                    style={{ width: `${p.fatigue}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
