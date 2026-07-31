"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";

export default function BoardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/board", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Impossible de joindre la direction.");
        setData(payload);
      })
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Réunion avec la direction…</div>;

  const season = data?.season;
  const standing = data?.standing;
  const confidence = season?.board_confidence ?? 60;
  const met = season?.objective_met;

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <section className="rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">Salle du conseil</p>
          <h1 className="mt-2 font-display text-3xl font-semibold md:text-5xl">Direction du club</h1>
          <p className="mt-2 text-sm text-muted">La confiance dépend des résultats et du respect de l’objectif fixé.</p>
        </section>

        {error && <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

        {!season ? <div className="mt-5 rounded-2xl border border-white/10 bg-pitch-900/85 p-6"><p className="text-muted">Aucune saison n’est encore disponible.</p><Link href="/league" className="mt-4 inline-block rounded-xl bg-carmine px-4 py-3">Créer le championnat</Link></div> : <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Mission du conseil</p>
            <h2 className="mt-2 font-display text-3xl">{season.objective_label ?? "Objectif en préparation"}</h2>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <Metric label="Position" value={standing?.position ? `${standing.position}e` : "—"} />
              <Metric label="Cible" value={season.target_position ? `Top ${season.target_position}` : "—"} />
              <Metric label="Points" value={String(standing?.points ?? 0)} />
            </div>
            <div className="mt-6"><div className="flex justify-between text-xs"><span className="text-muted">Confiance</span><span className="font-mono">{confidence}/100</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-carmine transition-all" style={{ width: `${confidence}%` }} /></div></div>
            <p className="mt-4 text-sm text-muted">{confidence >= 80 ? "Le conseil est ravi de ton travail." : confidence >= 55 ? "La direction reste confiante." : confidence >= 30 ? "Les résultats commencent à inquiéter." : "Ton poste est sérieusement menacé."}</p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Bilan de saison</p>
            <h2 className="mt-2 font-display text-3xl">{season.status === "finished" ? "Verdict final" : `Journée ${season.current_round}`}</h2>
            {season.status === "finished" ? <div className="mt-5 space-y-3">
              <div className={`rounded-xl border p-4 ${met ? "border-emerald-400/20 bg-emerald-500/10" : "border-rose-400/20 bg-rose-500/10"}`}><p className="font-semibold">{met ? "Objectif atteint" : "Objectif manqué"}</p><p className="mt-1 text-sm text-muted">Classement final : {season.final_position ?? standing?.position ?? "—"}</p></div>
              <Metric label="Prime finale" value={`${Number(season.final_bonus ?? 0).toLocaleString("fr-FR")} €`} />
              <Link href="/league" className="block rounded-xl bg-carmine px-4 py-3 text-center font-semibold">Lancer la saison suivante</Link>
            </div> : <div className="mt-5 space-y-3 text-sm text-muted"><p>Chaque victoire améliore la confiance. Les défaites répétées et une position sous l’objectif la font baisser.</p><Link href="/tactics" className="block rounded-xl bg-carmine px-4 py-3 text-center font-semibold text-white">Préparer le prochain match</Link></div>}
          </section>
        </div>}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3"><p className="text-[8px] uppercase tracking-wide text-muted">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>;
}
