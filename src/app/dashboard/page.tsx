import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import Crest from "@/components/Crest";

function formatMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} k€`;
  return `${n} €`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) redirect("/");

  const { data: club } = await supabase.from("clubs").select("*").eq("id", profile.club_id).single();
  const { data: players } = await supabase.from("players").select("*").eq("club_id", profile.club_id);
  const { data: recentMatches } = await supabase
    .from("matches")
    .select("*")
    .or(`home_club_id.eq.${profile.club_id},away_club_id.eq.${profile.club_id}`)
    .order("played_at", { ascending: false })
    .limit(5);

  const avgOverall = players?.length
    ? Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length)
    : 0;
  const totalMatches = (club?.wins ?? 0) + (club?.draws ?? 0) + (club?.losses ?? 0);

  return (
    <div className="min-h-screen pitch-bg pb-24 md:pb-8">
      <Nav />
      <main className="max-w-5xl mx-auto px-5 py-8">
        <div className="ticket-card bg-gradient-to-br from-pitch-900 to-pitch-800 border border-pitch-700 p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Crest
                shape={club?.crest_shape ?? "shield"}
                primaryColor={club?.primary_color ?? "#C81E3A"}
                secondaryColor={club?.secondary_color ?? "#0E1015"}
                icon={club?.crest_icon ?? "⚽"}
                size={56}
              />
              <div>
                <span className="text-xs uppercase tracking-widest text-muted font-mono">Ton club</span>
                <h1 className="font-display text-3xl font-semibold mt-1">{club?.name}</h1>
                <span className="text-sm text-muted">Réputation {club?.reputation}/100</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase tracking-widest text-muted font-mono">Trésorerie</span>
              <p className="font-display text-3xl text-gold">{formatMoney(club?.balance ?? 0)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Victoires" value={club?.wins ?? 0} accent="text-pitchgreen" />
          <StatCard label="Nuls" value={club?.draws ?? 0} accent="text-gold" />
          <StatCard label="Défaites" value={club?.losses ?? 0} accent="text-carmine-light" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-pitch-900 border border-pitch-700 rounded-lg p-5">
            <h2 className="font-display text-lg mb-3">Effectif</h2>
            <p className="text-sm text-muted mb-1">
              {players?.length ?? 0} joueurs · Niveau moyen{" "}
              <span className="text-white font-mono">{avgOverall}</span>
            </p>
            <p className="text-sm text-muted">
              Formation actuelle : <span className="text-white">{club?.formation}</span> · Style :{" "}
              <span className="text-white">{club?.tactic_style}</span>
            </p>
          </div>

          <div className="bg-pitch-900 border border-pitch-700 rounded-lg p-5">
            <h2 className="font-display text-lg mb-3">Derniers résultats</h2>
            {!recentMatches?.length && <p className="text-sm text-muted">Aucun match joué. Direction l&apos;onglet Match.</p>}
            <ul className="space-y-2">
              {recentMatches?.map((m) => {
                const isHome = m.home_club_id === profile.club_id;
                const myScore = isHome ? m.home_score : m.away_score;
                const oppScore = isHome ? m.away_score : m.home_score;
                const result = myScore > oppScore ? "V" : myScore === oppScore ? "N" : "D";
                const color = result === "V" ? "text-pitchgreen" : result === "N" ? "text-gold" : "text-carmine-light";
                return (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <span className={`font-mono font-bold ${color}`}>{result}</span>
                    <span className="text-muted">{isHome ? "Domicile" : "Extérieur"}</span>
                    <span className="font-mono">{myScore} - {oppScore}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-pitch-900 border border-pitch-700 rounded-lg p-4 text-center">
      <p className={`font-display text-2xl ${accent}`}>{value}</p>
      <p className="text-xs text-muted uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}
