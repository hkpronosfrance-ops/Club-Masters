"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

const ROUND_LABELS: Record<number, string> = { 1: "Quarts de finale", 2: "Demi-finales", 3: "Finale" };

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export default function EuropePage() {
  const [code, setCode] = useState("champions_league");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState("");

  async function load(selected = code) {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/europe?code=${selected}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) setError(payload.error ?? "Chargement impossible.");
    else setData(payload);
    setLoading(false);
  }

  useEffect(() => { load(code); }, [code]);

  async function simulateNext() {
    setSimulating(true);
    setError("");
    const response = await fetch(`/api/europe?code=${code}`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) setError(payload.error ?? "Simulation impossible.");
    else setData(payload);
    setSimulating(false);
  }

  const champion = data?.matches?.find((match: any) => match.round === 3 && match.played)?.winner;

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-10">
        <section className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-carmine-light">Soirées européennes</p>
          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-display text-3xl md:text-5xl">Compétitions européennes</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted">Affronte les clubs les plus réputés, gagne des primes majeures et construis la renommée internationale de ton club.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/15 p-1">
              <button onClick={() => setCode("champions_league")} className={`rounded-xl px-4 py-2 text-sm ${code === "champions_league" ? "bg-carmine text-white" : "text-muted"}`}>Champions</button>
              <button onClick={() => setCode("europa_league")} className={`rounded-xl px-4 py-2 text-sm ${code === "europa_league" ? "bg-carmine text-white" : "text-muted"}`}>Europa</button>
            </div>
          </div>
        </section>

        {error && <div className="mb-4 rounded-xl border border-carmine/30 bg-carmine/10 p-4 text-sm text-carmine-light">{error}</div>}
        {loading ? <div className="py-20 text-center text-muted">Chargement de la compétition…</div> : data && (
          <>
            <section className="mb-5 grid gap-3 md:grid-cols-4">
              <Card label="Compétition" value={data.competition.name} />
              <Card label="Tour actuel" value={ROUND_LABELS[data.competition.current_round]} />
              <Card label="Statut" value={data.competition.status === "finished" ? "Terminée" : "En cours"} />
              <Card label="Prime du tour" value={formatMoney(data.prizes[data.competition.current_round] ?? 0)} />
            </section>

            {champion && (
              <section className="mb-5 rounded-3xl border border-gold/25 bg-gold/10 p-6 text-center">
                <p className="text-xs uppercase tracking-[0.25em] text-gold">Champion d'Europe</p>
                <h2 className="mt-2 font-display text-4xl">{champion.name}</h2>
              </section>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              {[1, 2, 3].map((round) => (
                <section key={round} className="rounded-2xl border border-white/10 bg-pitch-900/80 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-xl">{ROUND_LABELS[round]}</h2>
                    <span className="font-mono text-[10px] text-gold">{formatMoney(data.prizes[round])}</span>
                  </div>
                  <div className="space-y-3">
                    {data.matches.filter((match: any) => match.round === round).map((match: any) => (
                      <article key={match.id} className="rounded-xl border border-white/8 bg-black/15 p-3">
                        <TeamRow name={match.home?.name} score={match.home_score} winner={match.winner_club_id === match.home_club_id} played={match.played} />
                        <TeamRow name={match.away?.name} score={match.away_score} winner={match.winner_club_id === match.away_club_id} played={match.played} />
                        {match.home_penalties !== null && <p className="mt-2 text-[10px] text-muted">TAB : {match.home_penalties}–{match.away_penalties}</p>}
                        {match.extra_time && <p className="mt-1 text-[10px] text-muted">Après prolongation</p>}
                      </article>
                    ))}
                    {!data.matches.some((match: any) => match.round === round) && <p className="py-8 text-center text-xs text-muted">Tour à venir</p>}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-6 flex justify-center">
              <button onClick={simulateNext} disabled={simulating || data.competition.status === "finished"} className="rounded-xl bg-carmine px-6 py-3 text-sm font-semibold text-white disabled:opacity-40">
                {simulating ? "Simulation…" : data.competition.status === "finished" ? "Compétition terminée" : "Simuler le prochain match"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-pitch-900/70 p-4"><p className="text-[9px] uppercase tracking-[0.18em] text-muted">{label}</p><p className="mt-2 font-mono text-sm text-white">{value}</p></div>;
}

function TeamRow({ name, score, winner, played }: { name?: string; score: number | null; winner: boolean; played: boolean }) {
  return <div className={`flex items-center justify-between rounded-lg px-2 py-2 text-sm ${winner ? "bg-gold/10 text-gold" : "text-zinc-200"}`}><span className="truncate">{name ?? "À déterminer"}</span><span className="font-mono">{played ? score : "–"}</span></div>;
}
