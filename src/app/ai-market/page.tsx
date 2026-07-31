"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";

function money(value: number) {
  if (!value) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M€`;
  return `${Math.round(value / 1_000)} k€`;
}

const labels: Record<string, string> = {
  purchase: "Transfert",
  sale: "Vente",
  renewal: "Prolongation",
  listing: "Mise en vente",
};

export default function AiMarketPage() {
  const [data, setData] = useState<any>({ events: [] });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);

  async function load() {
    const response = await fetch("/api/world/ai-market", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Chargement impossible.");
    setData(payload);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function simulate() {
    setRunning(true);
    setError(null);
    setSummary(null);
    try {
      const response = await fetch("/api/world/ai-market", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Simulation impossible.");
      setData(payload);
      setSummary(payload.summary);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const stats = useMemo(() => ({
    transfers: data.events.filter((event: any) => event.event_type === "purchase").length,
    renewals: data.events.filter((event: any) => event.event_type === "renewal").length,
    listings: data.events.filter((event: any) => event.event_type === "listing").length,
  }), [data.events]);

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Analyse du marché IA…</div>;

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-10">
        <section className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,30,58,0.2),transparent_42%)]" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-carmine-light">Intelligence artificielle</p>
              <h1 className="mt-2 font-display text-3xl md:text-5xl">Mercato des clubs IA</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Les clubs analysent leurs secteurs faibles, renouvellent leurs cadres et recrutent selon leur budget.</p>
            </div>
            <button onClick={simulate} disabled={running} className="rounded-xl bg-carmine px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {running ? "Décisions en cours…" : "Simuler le mercato du mois"}
            </button>
          </div>
        </section>

        {error && <div className="mb-5 rounded-xl border border-carmine/25 bg-carmine/10 p-4 text-sm text-carmine-light">{error}</div>}
        {summary && <div className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">{summary.actions} décisions : {summary.transfers} transfert(s), {summary.renewals} prolongation(s), {summary.listings} mise(s) en vente.</div>}

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <Metric label="Transferts enregistrés" value={stats.transfers} />
          <Metric label="Contrats prolongés" value={stats.renewals} />
          <Metric label="Joueurs placés sur le marché" value={stats.listings} />
        </section>

        <section>
          <h2 className="mb-3 font-display text-2xl">Dernières décisions</h2>
          <div className="space-y-3">
            {data.events.length === 0 && <div className="rounded-2xl border border-white/8 bg-pitch-900/75 p-6 text-sm text-muted">Aucune décision IA pour le moment. Avance d’abord le monde d’un mois, puis lance le mercato.</div>}
            {data.events.map((event: any) => (
              <article key={event.id} className="rounded-2xl border border-white/8 bg-pitch-900/80 p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-muted">{labels[event.event_type] ?? event.event_type}</span>
                    <h3 className="mt-3 text-base font-semibold text-white">
                      {event.player ? `${event.player.first_name} ${event.player.last_name}` : "Joueur indisponible"}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      {event.event_type === "purchase" && `${event.seller?.name ?? "Club vendeur"} → ${event.buyer?.name ?? "Club acheteur"}`}
                      {event.event_type === "renewal" && `Prolongation à ${event.buyer?.name ?? "son club"}`}
                      {event.event_type === "listing" && `Mis sur le marché par ${event.seller?.name ?? "son club"}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-base text-carmine-light">{money(Number(event.transfer_fee ?? 0))}</p>
                    <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-muted">Mois {event.cycle_number}</p>
                  </div>
                </div>
                {event.player && <div className="mt-4 flex gap-2 text-[10px] text-muted"><span>{event.player.position}</span><span>•</span><span>GEN {event.player.overall}</span></div>}
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/8 bg-pitch-900/80 p-4"><p className="text-[9px] uppercase tracking-[0.17em] text-muted">{label}</p><p className="mt-2 font-mono text-2xl text-white">{value}</p></div>;
}
