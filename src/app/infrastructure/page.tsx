"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

const facilities = [
  { key: "stadium", icon: "🏟️", title: "Stade", bonus: "Plus de billetterie et de prestige" },
  { key: "training", icon: "🏋️", title: "Centre d’entraînement", bonus: "Progression plus rapide des joueurs" },
  { key: "academy", icon: "🌟", title: "Académie", bonus: "Jeunes de meilleure qualité" },
  { key: "scouting", icon: "🔎", title: "Recrutement", bonus: "Meilleure détection et plus de cibles" },
  { key: "medical", icon: "🩺", title: "Centre médical", bonus: "Moins de blessures et récupération accélérée" },
];

function money(value: number) {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} M€` : `${Math.round(value / 1000)} k€`;
}

export default function InfrastructurePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/infrastructure", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Chargement impossible.");
    setData(payload);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function upgrade(facility: string) {
    setBusy(facility);
    setError(null);
    try {
      const response = await fetch("/api/infrastructure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facility }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Amélioration impossible.");
      setData(payload);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Chargement des infrastructures…</div>;

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-10">
        <section className="mb-6 rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-carmine-light">Développement du club</p>
          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-display text-3xl md:text-5xl">Bâtir une dynastie</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Investis dans les structures qui améliorent durablement les performances et les revenus du club.</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Trésorerie</p>
              <p className="mt-1 font-mono text-xl text-white">{money(Number(data?.club?.balance ?? 0))}</p>
            </div>
          </div>
        </section>

        {error && <div className="mb-5 rounded-xl border border-carmine/25 bg-carmine/10 p-4 text-sm text-carmine-light">{error}</div>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {facilities.map((facility) => {
            const level = Number(data?.infrastructure?.[`${facility.key}_level`] ?? 1);
            const project = (data?.projects ?? []).find((item: any) => item.facility === facility.key && item.status === "active");
            return (
              <article key={facility.key} className="rounded-2xl border border-white/8 bg-pitch-900/80 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-3xl">{facility.icon}</span>
                    <h2 className="mt-3 font-display text-2xl">{facility.title}</h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs">Niveau {level}/10</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full bg-carmine" style={{ width: `${level * 10}%` }} /></div>
                <p className="mt-4 text-sm leading-6 text-muted">{facility.bonus}</p>
                {project ? (
                  <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-xs text-amber-100">Travaux vers le niveau {project.to_level} · fin au cycle {project.completes_cycle}</div>
                ) : (
                  <button onClick={() => upgrade(facility.key)} disabled={busy === facility.key || level >= 10} className="mt-5 w-full rounded-xl bg-carmine px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
                    {level >= 10 ? "Niveau maximal" : busy === facility.key ? "Lancement…" : "Améliorer"}
                  </button>
                )}
              </article>
            );
          })}
        </section>

        <section className="mt-7">
          <h2 className="mb-3 font-display text-2xl">Historique des travaux</h2>
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-pitch-900/80">
            {(data?.projects ?? []).length === 0 && <p className="p-5 text-sm text-muted">Aucun chantier lancé.</p>}
            {(data?.projects ?? []).map((project: any) => (
              <div key={project.id} className="flex items-center justify-between gap-4 border-b border-white/6 px-4 py-3 last:border-0">
                <div><p className="text-sm text-white">{data.labels?.[project.facility] ?? project.facility}</p><p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">Niveau {project.from_level} → {project.to_level}</p></div>
                <div className="text-right"><p className="font-mono text-sm text-carmine-light">{money(Number(project.cost))}</p><p className="mt-1 text-[10px] uppercase text-muted">{project.status === "active" ? `Fin cycle ${project.completes_cycle}` : "Terminé"}</p></div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
