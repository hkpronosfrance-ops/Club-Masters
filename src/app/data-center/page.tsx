"use client";

import { useEffect, useMemo, useState } from "react";

type Leader = { player: { id: string; first_name: string; last_name: string; position: string; age: number; overall: number; potential: number; form: number }; matches: number; goals: number; assists: number; xg: number; xa: number; shots: number; keyPasses: number; tackles: number; interceptions: number; duelsWon: number; saves: number; averageRating: number };
type Data = { club: { name: string }; summary: { matches: number; possession: number; shots: number; shotsOnTarget: number; xg: number; passAccuracy: number; ppda: number }; leaderboard: Leader[]; insights: string[] };

const n = (value: number, digits = 1) => Number(value || 0).toFixed(digits);

export default function DataCenterPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");

  async function load() {
    setLoading(true); setError("");
    const response = await fetch("/api/data-center", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) setError(json.error ?? "Impossible de charger les données."); else { setData(json); setFirstId(json.leaderboard?.[0]?.player.id ?? ""); setSecondId(json.leaderboard?.[1]?.player.id ?? ""); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  const first = useMemo(() => data?.leaderboard.find((row) => row.player.id === firstId), [data, firstId]);
  const second = useMemo(() => data?.leaderboard.find((row) => row.player.id === secondId), [data, secondId]);

  if (loading) return <main className="p-6 md:p-10"><div className="text-muted">Analyse des performances…</div></main>;
  if (error || !data) return <main className="p-6 md:p-10"><div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div></main>;

  const cards = [
    ["Possession", `${n(data.summary.possession)}%`], ["xG / match", n(data.summary.xg, 2)], ["Tirs / match", n(data.summary.shots)], ["Tirs cadrés", n(data.summary.shotsOnTarget)], ["Passes réussies", `${n(data.summary.passAccuracy)}%`], ["PPDA", n(data.summary.ppda, 2)],
  ];

  return <main className="min-h-screen p-4 pb-28 md:p-10">
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div><p className="text-xs uppercase tracking-[.28em] text-carmine-light">Performance lab</p><h1 className="font-display text-3xl md:text-5xl">Centre de données</h1><p className="mt-2 text-muted">{data.club.name} · analyse des {data.summary.matches} derniers matchs</p></div>
        <button onClick={load} className="rounded-lg border border-pitch-600 px-4 py-2 text-sm hover:border-carmine">Actualiser l’analyse</button>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-pitch-700 bg-pitch-900/70 p-4"><div className="text-xs text-muted">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></div>)}</section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-pitch-700 bg-pitch-900/70">
          <div className="border-b border-pitch-700 p-5"><h2 className="text-xl font-semibold">Classement des joueurs</h2><p className="text-sm text-muted">Note moyenne et production cumulée</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="text-left text-xs uppercase text-muted"><tr className="border-b border-pitch-700"><th className="p-4">Joueur</th><th>MJ</th><th>Note</th><th>Buts</th><th>Passes D.</th><th>xG</th><th>xA</th><th>Actions déf.</th></tr></thead><tbody>{data.leaderboard.map((row, index) => <tr key={row.player.id} className="border-b border-pitch-800/80 hover:bg-pitch-800/50"><td className="p-4"><div className="font-medium">{index + 1}. {row.player.first_name} {row.player.last_name}</div><div className="text-xs text-muted">{row.player.position} · GEN {row.player.overall}</div></td><td>{row.matches}</td><td className="font-semibold text-carmine-light">{n(row.averageRating, 2)}</td><td>{row.goals}</td><td>{row.assists}</td><td>{n(row.xg, 2)}</td><td>{n(row.xa, 2)}</td><td>{row.tackles + row.interceptions + row.duelsWon}</td></tr>)}</tbody></table></div>
        </div>
        <div className="rounded-2xl border border-pitch-700 bg-pitch-900/70 p-5"><h2 className="text-xl font-semibold">Analyse tactique</h2><div className="mt-4 space-y-3">{data.insights.map((insight) => <div key={insight} className="rounded-xl bg-pitch-800 p-4 text-sm leading-6">{insight}</div>)}</div></div>
      </section>

      <section className="rounded-2xl border border-pitch-700 bg-pitch-900/70 p-5"><div className="mb-5"><h2 className="text-xl font-semibold">Comparateur de joueurs</h2><p className="text-sm text-muted">Compare deux membres de l’effectif sur leurs performances réelles.</p></div>
        <div className="grid gap-3 md:grid-cols-2"><select value={firstId} onChange={(e) => setFirstId(e.target.value)} className="rounded-lg border border-pitch-600 bg-pitch-950 p-3">{data.leaderboard.map((row) => <option key={row.player.id} value={row.player.id}>{row.player.first_name} {row.player.last_name}</option>)}</select><select value={secondId} onChange={(e) => setSecondId(e.target.value)} className="rounded-lg border border-pitch-600 bg-pitch-950 p-3">{data.leaderboard.map((row) => <option key={row.player.id} value={row.player.id}>{row.player.first_name} {row.player.last_name}</option>)}</select></div>
        {first && second && <div className="mt-5 grid gap-4 md:grid-cols-2">{[first, second].map((row) => <div key={row.player.id} className="rounded-xl border border-pitch-700 bg-pitch-950/60 p-5"><div className="text-lg font-semibold">{row.player.first_name} {row.player.last_name}</div><div className="text-sm text-muted">{row.player.position} · {row.player.age} ans · GEN {row.player.overall}</div><div className="mt-4 grid grid-cols-3 gap-3 text-center">{[["Note", n(row.averageRating, 2)], ["Buts", row.goals], ["Passes D.", row.assists], ["xG", n(row.xg, 2)], ["xA", n(row.xa, 2)], ["Duels", row.duelsWon]].map(([label, value]) => <div key={label} className="rounded-lg bg-pitch-800 p-3"><div className="text-xs text-muted">{label}</div><div className="mt-1 font-semibold">{value}</div></div>)}</div></div>)}</div>}
      </section>
    </div>
  </main>;
}