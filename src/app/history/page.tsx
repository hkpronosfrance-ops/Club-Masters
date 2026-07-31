"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

type Award = { id: string; award_label: string; winner_name: string; value_label: string | null };
type BestXi = { id: string; player_name: string; position: string; overall: number | null };
type Standing = { rank: number; club_name: string; played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number; points: number };
type Archive = { id: string; season_label: string; champion_name: string | null; total_clubs: number; total_matches: number; total_goals: number; archived_at: string; standings: Standing[]; awards: Award[]; bestXi: BestXi[] };

export default function HistoryPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/history", { cache: "no-store" })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); return payload; })
      .then((payload) => { setData(payload); setOpenId(payload.archives?.[0]?.id ?? null); })
      .catch((caught) => setError(caught.message ?? "Impossible de charger les archives."));
  }, []);

  const honours = data?.honours;
  return <div className="min-h-screen pitch-bg pb-28 md:pb-10"><Nav /><main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
    <header className="mb-6"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-carmine-light">Mémoire du monde</p><h1 className="mt-1 font-display text-4xl md:text-5xl">Histoire & Palmarès</h1><p className="mt-2 text-sm text-muted">Chaque saison terminée laisse une trace permanente.</p></header>
    {error && <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}
    {!data && !error ? <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-6 text-muted">Chargement des archives…</div> : data && <>
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Titres de champion" value={String(honours?.league_titles ?? 0)} />
        <Card label="Saisons archivées" value={String(honours?.seasons_played ?? 0)} />
        <Card label="Victoires historiques" value={String(honours?.total_wins ?? 0)} />
        <Card label="Buts marqués" value={String(honours?.total_goals_for ?? 0)} />
      </section>
      {(data.archives ?? []).length === 0 ? <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-muted">Aucune saison terminée pour le moment. Les archives seront créées automatiquement après la dernière journée.</div> : <div className="space-y-4">{data.archives.map((archive: Archive) => {
        const opened = openId === archive.id;
        return <article key={archive.id} className="overflow-hidden rounded-3xl border border-white/10 bg-pitch-900/85">
          <button onClick={() => setOpenId(opened ? null : archive.id)} className="flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left md:p-6"><div><p className="text-[10px] uppercase tracking-[0.18em] text-muted">{new Date(archive.archived_at).toLocaleDateString("fr-FR")}</p><h2 className="mt-1 font-display text-3xl">{archive.season_label}</h2><p className="mt-1 text-sm text-gold">🏆 {archive.champion_name ?? "Champion non attribué"}</p></div><div className="grid grid-cols-3 gap-2 text-center"><Mini label="Clubs" value={archive.total_clubs} /><Mini label="Matchs" value={archive.total_matches} /><Mini label="Buts" value={archive.total_goals} /></div></button>
          {opened && <div className="grid gap-5 border-t border-white/10 p-5 lg:grid-cols-[1.1fr_0.9fr] md:p-6">
            <section><h3 className="font-display text-2xl">Classement final</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="text-left text-[10px] uppercase text-muted"><tr><th className="p-2">#</th><th>Club</th><th>J</th><th>G</th><th>N</th><th>P</th><th>BP</th><th>BC</th><th>Pts</th></tr></thead><tbody>{(archive.standings ?? []).map((row) => <tr key={row.rank} className="border-t border-white/5"><td className="p-2 font-mono">{row.rank}</td><td className="font-semibold">{row.club_name}</td><td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.goals_for}</td><td>{row.goals_against}</td><td className="font-bold">{row.points}</td></tr>)}</tbody></table></div></section>
            <section className="space-y-5"><div><h3 className="font-display text-2xl">Récompenses</h3><div className="mt-3 grid gap-2">{archive.awards.map((award) => <div key={award.id} className="rounded-xl bg-white/5 p-3"><p className="text-[10px] uppercase text-muted">{award.award_label}</p><p className="mt-1 font-semibold">{award.winner_name}</p>{award.value_label && <p className="mt-1 text-xs text-carmine-light">{award.value_label}</p>}</div>)}</div></div><div><h3 className="font-display text-2xl">Équipe de la saison</h3><div className="mt-3 grid grid-cols-2 gap-2">{archive.bestXi.map((player) => <div key={player.id} className="rounded-xl bg-white/5 p-3 text-sm"><span className="text-carmine-light">{player.position}</span><p className="font-semibold">{player.player_name}</p><p className="text-xs text-muted">GEN {player.overall ?? "-"}</p></div>)}</div></div></section>
          </div>}
        </article>;
      })}</div>}
    </>}
  </main></div>;
}

function Card({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-4"><p className="text-[10px] uppercase tracking-[0.15em] text-muted">{label}</p><p className="mt-2 font-display text-3xl">{value}</p></div>; }
function Mini({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-white/5 px-3 py-2"><p className="text-[9px] uppercase text-muted">{label}</p><p className="font-mono">{value}</p></div>; }
