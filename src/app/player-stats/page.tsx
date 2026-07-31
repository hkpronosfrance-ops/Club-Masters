"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";

type Row = {
  id: string; player_id: string; club_id: string; first_name: string; last_name: string; age: number; position: string; club_name: string;
  appearances: number; starts: number; minutes: number; goals: number; assists: number; shots: number; shots_on_target: number;
  yellow_cards: number; red_cards: number; clean_sheets: number; goals_conceded: number; saves: number; man_of_match: number; average_rating: number;
};
type Payload = { seasons: Array<{ id: string; name: string; status: string }>; seasonId: string | null; rows: Row[]; userClubId: string };

export default function PlayerStatsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [seasonId, setSeasonId] = useState("");
  const [tab, setTab] = useState<"goals" | "assists" | "rating" | "keepers" | "young">("goals");
  const [message, setMessage] = useState("");

  async function load(id?: string) {
    const response = await fetch(`/api/player-stats${id ? `?seasonId=${id}` : ""}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error ?? "Impossible de charger les statistiques.");
    setData(payload); setSeasonId(payload.seasonId ?? "");
  }
  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => {
    const base = [...(data?.rows ?? [])];
    if (tab === "goals") return base.sort((a, b) => b.goals - a.goals || b.assists - a.assists);
    if (tab === "assists") return base.sort((a, b) => b.assists - a.assists || b.goals - a.goals);
    if (tab === "rating") return base.filter((row) => row.appearances >= 2).sort((a, b) => Number(b.average_rating) - Number(a.average_rating));
    if (tab === "keepers") return base.filter((row) => row.position === "GK").sort((a, b) => b.clean_sheets - a.clean_sheets || Number(b.average_rating) - Number(a.average_rating));
    return base.filter((row) => row.age <= 21).sort((a, b) => Number(b.average_rating) - Number(a.average_rating) || b.goals - a.goals);
  }, [data, tab]);

  return <div className="min-h-screen pitch-bg pb-28 md:pb-10"><Nav /><main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
    <header className="mb-6"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-carmine-light">Data Center</p><div className="mt-1 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-4xl md:text-5xl">Statistiques joueurs</h1><p className="mt-2 text-sm text-muted">Buteurs, passeurs, gardiens, notes et performances saison après saison.</p></div><select value={seasonId} onChange={(event) => { setSeasonId(event.target.value); void load(event.target.value); }} className="rounded-xl border border-white/10 bg-pitch-900 px-4 py-3 text-sm">{data?.seasons.map((season) => <option key={season.id} value={season.id}>{season.name} {season.status === "active" ? "· en cours" : ""}</option>)}</select></div></header>
    {message && <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{message}</div>}
    <div className="mb-5 flex gap-2 overflow-x-auto">{[["goals","Buteurs"],["assists","Passeurs"],["rating","Meilleures notes"],["keepers","Gardiens"],["young","Jeunes"]].map(([value,label]) => <button key={value} onClick={() => setTab(value as typeof tab)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm ${tab === value ? "bg-carmine text-white" : "border border-white/10 bg-white/5 text-muted"}`}>{label}</button>)}</div>
    {!data ? <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-6 text-muted">Chargement…</div> : <section className="overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/85"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-black/20 text-[10px] uppercase tracking-wider text-muted"><tr><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">Joueur</th><th className="px-3 py-3">MJ</th><th className="px-3 py-3">Min.</th><th className="px-3 py-3">Buts</th><th className="px-3 py-3">Passes</th><th className="px-3 py-3">Note</th><th className="px-3 py-3">Tirs cadrés</th><th className="px-3 py-3">Clean sheets</th><th className="px-3 py-3">H. match</th><th className="px-3 py-3">Cartons</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id} className={`border-t border-white/5 ${row.club_id === data.userClubId ? "bg-carmine/5" : ""}`}><td className="px-4 py-3 font-mono text-muted">{index + 1}</td><td className="px-4 py-3"><p className="font-semibold">{row.first_name} {row.last_name}</p><p className="text-[10px] text-muted">{row.club_name} · {row.position} · {row.age} ans</p></td><td className="px-3 py-3 text-center">{row.appearances}</td><td className="px-3 py-3 text-center">{row.minutes}</td><td className="px-3 py-3 text-center font-display text-lg">{row.goals}</td><td className="px-3 py-3 text-center">{row.assists}</td><td className="px-3 py-3 text-center text-gold">{Number(row.average_rating).toFixed(2)}</td><td className="px-3 py-3 text-center">{row.shots_on_target}/{row.shots}</td><td className="px-3 py-3 text-center">{row.clean_sheets}</td><td className="px-3 py-3 text-center">{row.man_of_match}</td><td className="px-3 py-3 text-center"><span className="text-amber-300">{row.yellow_cards}</span> / <span className="text-rose-400">{row.red_cards}</span></td></tr>)}{rows.length === 0 && <tr><td colSpan={11} className="px-4 py-10 text-center text-muted">Aucune statistique enregistrée pour cette saison. Joue un match après avoir appliqué la migration.</td></tr>}</tbody></table></div></section>}
  </main></div>;
}
