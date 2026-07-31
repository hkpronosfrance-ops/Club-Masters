"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

const ROUND_LABELS: Record<number, string> = { 1: "Quarts de finale", 2: "Demi-finales", 3: "Finale" };

function formatMoney(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M€`;
  return `${Math.round(value / 1_000)} k€`;
}

export default function CupPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const response = await fetch("/api/cup", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) setError(payload.error ?? "Impossible de charger la coupe.");
    else setData(payload);
    setLoading(false);
  }

  async function simulate() {
    setSimulating(true);
    setError(null);
    const response = await fetch("/api/cup", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) setError(payload.error ?? "La simulation a échoué.");
    else setData(payload);
    setSimulating(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Préparation du tirage…</div>;

  const competition = data?.competition;
  const matches = data?.matches ?? [];
  const pending = matches.find((match: any) => !match.played);
  const champion = matches.find((match: any) => match.round === 3 && match.played)?.winner;

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-10">
        <section className="relative overflow-hidden rounded-3xl border border-gold/20 bg-pitch-900/90 p-5 shadow-2xl md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_45%)]" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">Compétition nationale</p>
              <h1 className="mt-2 font-display text-4xl md:text-6xl">Coupe Nationale</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Huit clubs, trois tours et un seul trophée. Chaque rencontre est à élimination directe.</p>
            </div>
            <button onClick={simulate} disabled={simulating || !pending || competition?.status === "finished"} className="rounded-2xl bg-carmine px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {simulating ? "Match en cours…" : pending ? `Jouer : ${pending.home?.name} – ${pending.away?.name}` : "Compétition terminée"}
            </button>
          </div>
        </section>

        {error && <div className="mt-4 rounded-xl border border-carmine/30 bg-carmine/10 px-4 py-3 text-sm text-carmine-light">{error}</div>}

        {champion && (
          <section className="mt-5 rounded-3xl border border-gold/30 bg-gold/10 p-6 text-center">
            <p className="text-4xl">🏆</p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-gold">Champion</p>
            <h2 className="mt-2 font-display text-4xl">{champion.name}</h2>
          </section>
        )}

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((round) => {
            const roundMatches = matches.filter((match: any) => match.round === round);
            return (
              <div key={round} className="rounded-2xl border border-white/10 bg-pitch-900/80 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-carmine-light">Tour {round}</p>
                    <h2 className="mt-1 font-display text-2xl">{ROUND_LABELS[round]}</h2>
                  </div>
                  <span className="rounded-lg border border-gold/20 bg-gold/5 px-2 py-1 font-mono text-[10px] text-gold">{formatMoney(data?.prizes?.[round] ?? 0)}</span>
                </div>

                <div className="space-y-3">
                  {roundMatches.length === 0 && <div className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-xs text-muted">En attente du tour précédent</div>}
                  {roundMatches.map((match: any) => (
                    <article key={match.id} className={`rounded-xl border p-3 ${match.played ? "border-white/10 bg-black/10" : "border-carmine/30 bg-carmine/5"}`}>
                      <TeamLine name={match.home?.name ?? "À déterminer"} score={match.home_score} winner={match.winner_club_id === match.home_club_id} />
                      <TeamLine name={match.away?.name ?? "À déterminer"} score={match.away_score} winner={match.winner_club_id === match.away_club_id} />
                      {match.home_penalties !== null && <p className="mt-2 border-t border-white/8 pt-2 text-center font-mono text-[10px] text-muted">TAB {match.home_penalties}–{match.away_penalties}</p>}
                      {match.extra_time && match.home_penalties === null && <p className="mt-2 text-center text-[9px] uppercase tracking-[0.16em] text-muted">Après prolongation</p>}
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}

function TeamLine({ name, score, winner }: { name: string; score: number | null; winner: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 ${winner ? "text-white" : "text-zinc-400"}`}>
      <span className="truncate text-sm">{winner && <span className="mr-2 text-gold">●</span>}{name}</span>
      <span className="font-mono text-lg">{score ?? "–"}</span>
    </div>
  );
}
