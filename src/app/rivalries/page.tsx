"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

type Rivalry = {
  id: string;
  name: string;
  rivalry_type: string;
  intensity: number;
  meetings: number;
  club_a_wins: number;
  club_b_wins: number;
  draws: number;
  club_a_id: string;
  club_b_id: string;
  club_a: { id: string; name: string };
  club_b: { id: string; name: string };
  last_winner?: { id: string; name: string } | null;
};

type Payload = {
  clubId: string;
  rivalries: Rivalry[];
  upcoming: Array<{ id: string; round: number; isRivalry: boolean; home: { name: string }; away: { name: string } }>;
};

const labels: Record<string, string> = { derby: "Derby", historic: "Rivalité historique", regional: "Rivalité régionale", title: "Duel au sommet" };

export default function RivalriesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/rivalries", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Chargement impossible.");
        setData(payload);
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  return <div className="min-h-screen pitch-bg pb-28 md:pb-10"><Nav /><main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
    <header className="mb-6"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-carmine-light">Identité du club</p><h1 className="mt-1 font-display text-4xl md:text-5xl">Rivalités & Derbies</h1><p className="mt-2 text-sm text-muted">Les matchs qui comptent plus que les autres : tribunes pleines, pression maximale et histoire en jeu.</p></header>
    {error && <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-300">{error}</div>}
    {!data && !error ? <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-6 text-muted">Chargement des rivalités…</div> : data && <>
      <section className="grid gap-4 lg:grid-cols-2">
        {data.rivalries.length === 0 ? <div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-6 text-muted">Aucune rivalité officielle n’est encore enregistrée pour ton club.</div> : data.rivalries.map((rivalry) => {
          const myIsA = rivalry.club_a_id === data.clubId;
          const opponent = myIsA ? rivalry.club_b : rivalry.club_a;
          const myWins = myIsA ? rivalry.club_a_wins : rivalry.club_b_wins;
          const opponentWins = myIsA ? rivalry.club_b_wins : rivalry.club_a_wins;
          return <article key={rivalry.id} className="overflow-hidden rounded-3xl border border-white/10 bg-pitch-900/90">
            <div className="border-b border-white/10 bg-black/15 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.2em] text-carmine-light">{labels[rivalry.rivalry_type] ?? "Rivalité"}</p><h2 className="mt-1 font-display text-3xl">{rivalry.name}</h2><p className="mt-1 text-sm text-muted">Adversaire : {opponent.name}</p></div><div className="rounded-2xl bg-carmine/10 px-4 py-3 text-center"><p className="text-[9px] uppercase text-muted">Intensité</p><p className="font-display text-2xl">{rivalry.intensity}</p></div></div></div>
            <div className="grid grid-cols-4 gap-px bg-white/10"><Stat label="Duels" value={rivalry.meetings} /><Stat label="Victoires" value={myWins} /><Stat label="Nuls" value={rivalry.draws} /><Stat label="Défaites" value={opponentWins} /></div>
            <div className="p-5"><div className="h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-carmine" style={{ width: `${rivalry.intensity}%` }} /></div><p className="mt-3 text-sm text-muted">Bonus prévu : +{Math.round(rivalry.intensity / 2.5)}% de demande, +{Math.round(rivalry.intensity * 0.22)} d’ambiance et pression accrue sur les joueurs.</p>{rivalry.last_winner && <p className="mt-2 text-xs text-zinc-300">Dernier vainqueur : {rivalry.last_winner.name}</p>}</div>
          </article>;
        })}
      </section>

      <section className="mt-5 rounded-2xl border border-white/10 bg-pitch-900/85 p-5"><h2 className="font-display text-2xl">Prochains matchs</h2><div className="mt-4 space-y-2">{data.upcoming.length === 0 ? <p className="text-sm text-muted">Aucun match programmé.</p> : data.upcoming.map((fixture) => <div key={fixture.id} className={`flex items-center justify-between rounded-xl border p-3 text-sm ${fixture.isRivalry ? "border-carmine/40 bg-carmine/10" : "border-white/5 bg-white/[0.03]"}`}><span className="font-mono text-xs text-muted">J{fixture.round}</span><span>{fixture.home.name} — {fixture.away.name}</span><span className={fixture.isRivalry ? "text-carmine-light" : "text-muted"}>{fixture.isRivalry ? "🔥 Rivalité" : "Championnat"}</span></div>)}</div></section>
    </>}
  </main></div>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="bg-pitch-900 p-4 text-center"><p className="text-[9px] uppercase tracking-wide text-muted">{label}</p><p className="mt-1 font-display text-xl">{value}</p></div>; }
