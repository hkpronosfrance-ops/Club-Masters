"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Player = {
  id: string;
  first_name: string;
  last_name: string;
  age: number;
  position: string;
  overall: number;
  potential: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  morale: number;
  fatigue: number;
  form: number;
  value: number;
  wage: number;
};

const GROUPS = ["Tous", "Gardiens", "Défenseurs", "Milieux", "Attaquants"];

function groupOf(position: string) {
  if (position === "GK") return "Gardiens";
  if (["DC", "DL", "DR"].includes(position)) return "Défenseurs";
  if (["MDC", "MC", "MOC"].includes(position)) return "Milieux";
  return "Attaquants";
}

function formatMoney(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M€`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} k€`;
  return `${value} €`;
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.14em] text-muted">
        <span>{label}</span><span className="font-mono text-zinc-200">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-carmine" style={{ width: `${Math.max(4, value)}%` }} />
      </div>
    </div>
  );
}

export default function SquadClient({ players }: { players: Player[] }) {
  const [group, setGroup] = useState("Tous");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((player) => {
      const matchesGroup = group === "Tous" || groupOf(player.position) === group;
      const matchesQuery = !q || `${player.first_name} ${player.last_name}`.toLowerCase().includes(q);
      return matchesGroup && matchesQuery;
    });
  }, [group, players, query]);

  const average = players.length ? Math.round(players.reduce((sum, p) => sum + p.overall, 0) / players.length) : 0;
  const averageAge = players.length ? (players.reduce((sum, p) => sum + p.age, 0) / players.length).toFixed(1) : "0";
  const totalValue = players.reduce((sum, p) => sum + (p.value ?? 0), 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
      <section className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/90 p-5 shadow-xl md:p-7">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-carmine-light">Direction sportive</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold md:text-4xl">Effectif professionnel</h1>
            <p className="mt-2 hidden max-w-xl text-sm text-muted md:block">Analyse la forme, la progression et l’état physique de chaque joueur.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right">
            <p className="text-[9px] uppercase tracking-[0.18em] text-muted">Joueurs</p>
            <p className="font-mono text-xl text-white">{players.length}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Metric label="Note moy." value={String(average)} />
          <Metric label="Âge moyen" value={averageAge} />
          <Metric label="Valeur" value={formatMoney(totalValue)} />
        </div>
      </section>

      <section className="mb-5 grid gap-3 rounded-2xl border border-white/8 bg-pitch-900/70 p-3 sm:grid-cols-[1fr_auto]">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un joueur…" className="field-input" />
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="field-input sm:min-w-44">
          {GROUPS.map((item) => <option key={item}>{item}</option>)}
        </select>
      </section>

      <p className="mb-4 text-xs uppercase tracking-[0.16em] text-muted">{filtered.length} joueurs affichés</p>

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((player) => {
          const expanded = expandedId === player.id;
          const freshness = 100 - player.fatigue;
          return (
            <article key={player.id} className="overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/90">
              <div className="flex items-start gap-4 p-4">
                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <span className="font-display text-2xl font-semibold">{player.overall}</span>
                  <span className="text-[9px] uppercase tracking-wider text-muted">Note</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">{player.first_name} {player.last_name}</h2>
                      <p className="mt-1 text-xs text-muted">{player.age} ans · Potentiel {player.potential}</p>
                    </div>
                    <span className="h-fit rounded-full border border-carmine/25 bg-carmine/10 px-2.5 py-1 font-mono text-[10px] font-bold text-carmine-light">{player.position}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                    <Mini label="Forme" value={player.form} />
                    <Mini label="Moral" value={player.morale} />
                    <Mini label="Frais" value={freshness} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-white/8 px-4 py-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Valeur</p>
                  <p className="font-mono text-sm text-gold">{formatMoney(player.value)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setExpandedId(expanded ? null : player.id)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200">
                    {expanded ? "Réduire" : "Stats"}
                  </button>
                  <Link href={`/players/${player.id}`} className="rounded-xl bg-carmine px-3 py-2 text-xs font-semibold text-white">
                    Profil complet
                  </Link>
                </div>
              </div>

              {expanded && (
                <div className="grid grid-cols-2 gap-x-5 gap-y-3 border-t border-white/8 p-4 sm:grid-cols-3">
                  <StatBar label="Vitesse" value={player.pace} />
                  <StatBar label="Tir" value={player.shooting} />
                  <StatBar label="Passe" value={player.passing} />
                  <StatBar label="Défense" value={player.defending} />
                  <StatBar label="Physique" value={player.physical} />
                  <StatBar label="Fraîcheur" value={freshness} />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 px-3 py-3 text-center"><p className="text-[9px] uppercase tracking-[0.14em] text-muted">{label}</p><p className="mt-1 font-mono text-sm text-white">{value}</p></div>;
}

function Mini({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-white/5 px-2 py-2"><p className="text-muted">{label}</p><p className="mt-0.5 font-mono text-zinc-100">{value}</p></div>;
}
