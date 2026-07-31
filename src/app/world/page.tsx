"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";

function formatMoney(value: number) {
  const sign = value < 0 ? "−" : "+";
  const amount = Math.abs(value);
  if (amount >= 1_000_000) return `${sign}${(amount / 1_000_000).toFixed(2)} M€`;
  return `${sign}${Math.round(amount / 1_000)} k€`;
}

const categoryLabel: Record<string, string> = {
  finance: "Finance",
  transfer: "Mercato",
  form: "Forme",
  injury: "Blessure",
  academy: "Académie",
  competition: "Compétition",
  club: "Club",
};

export default function WorldPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  async function load() {
    const response = await fetch("/api/world", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Chargement impossible.");
    setData(payload);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function advanceWorld() {
    setAdvancing(true);
    setError(null);
    try {
      const response = await fetch("/api/world", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Simulation impossible.");
      setData(payload);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdvancing(false);
    }
  }

  const news = useMemo(() => {
    if (!data?.news) return [];
    return filter === "all" ? data.news : data.news.filter((item: any) => item.category === filter);
  }, [data, filter]);

  const monthBalance = useMemo(() => {
    if (!data?.finances?.length || !data?.latestCycle) return 0;
    return data.finances
      .filter((entry: any) => entry.cycle_number === data.latestCycle.cycle_number)
      .reduce((sum: number, entry: any) => sum + Number(entry.amount), 0);
  }, [data]);

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Chargement du monde…</div>;

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-10">
        <section className="relative mb-5 overflow-hidden rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,30,58,0.22),transparent_42%)]" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-carmine-light">Simulation globale</p>
              <h1 className="mt-2 font-display text-3xl md:text-5xl">Le monde du football vit</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Les clubs encaissent leurs revenus, paient leurs charges et alimentent automatiquement l’actualité.</p>
            </div>
            <button onClick={advanceWorld} disabled={advancing} className="rounded-xl bg-carmine px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {advancing ? "Simulation en cours…" : `Passer au ${data?.latestCycle ? `mois ${data.latestCycle.cycle_number + 1}` : "premier mois"}`}
            </button>
          </div>
        </section>

        {error && <div className="mb-5 rounded-xl border border-carmine/25 bg-carmine/10 p-4 text-sm text-carmine-light">{error}</div>}

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <Metric label="Cycle actuel" value={data?.latestCycle?.label ?? "Pré-saison"} />
          <Metric label="Trésorerie" value={`${Math.round(Number(data?.club?.balance ?? 0) / 1000)} k€`} />
          <Metric label="Résultat du mois" value={formatMoney(monthBalance)} positive={monthBalance >= 0} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.45fr_0.8fr]">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl">Fil d’actualité</h2>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="field-input min-w-36">
                <option value="all">Tout afficher</option>
                {Object.entries(categoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-3">
              {news.length === 0 && <div className="rounded-2xl border border-white/8 bg-pitch-900/70 p-6 text-sm text-muted">Fais avancer le monde pour générer les premières actualités.</div>}
              {news.map((item: any) => (
                <article key={item.id} className="rounded-2xl border border-white/8 bg-pitch-900/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-muted">{categoryLabel[item.category] ?? item.category}</span>
                    <span className="text-[10px] text-muted">Importance {item.importance}/5</span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
                  {item.clubs?.name && <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-carmine-light">{item.clubs.name}</p>}
                </article>
              ))}
            </div>
          </section>

          <aside>
            <h2 className="mb-3 font-display text-2xl">Journal financier</h2>
            <div className="overflow-hidden rounded-2xl border border-white/8 bg-pitch-900/80">
              {(data?.finances ?? []).length === 0 && <p className="p-5 text-sm text-muted">Aucune opération enregistrée.</p>}
              {(data?.finances ?? []).map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 border-b border-white/6 px-4 py-3 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-zinc-200">{entry.description}</p>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-muted">Mois {entry.cycle_number}</p>
                  </div>
                  <span className={`shrink-0 font-mono text-sm ${Number(entry.amount) >= 0 ? "text-emerald-300" : "text-carmine-light"}`}>{formatMoney(Number(entry.amount))}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return <div className="rounded-2xl border border-white/8 bg-pitch-900/80 p-4"><p className="text-[9px] uppercase tracking-[0.17em] text-muted">{label}</p><p className={`mt-2 font-mono text-xl ${positive === true ? "text-emerald-300" : positive === false ? "text-carmine-light" : "text-white"}`}>{value}</p></div>;
}
