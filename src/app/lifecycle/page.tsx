"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";

type EventRow = { id:string; event_type:string; player_name:string; club_id:string|null; details:Record<string,unknown>; created_at:string };
type PlayerRow = { id:string; first_name:string; last_name:string; age:number; position:string; overall:number; potential?:number; club_id?:string; club?:{ name:string }|null; retired_at?:string|null };

const LABELS:Record<string,string> = {
  aged:"A pris un an",
  progressed:"Progression",
  declined:"Régression",
  retired:"Retraite",
  regen_created:"Nouveau talent",
};

export default function LifecyclePage() {
  const [data,setData] = useState<{events:EventRow[];retired:PlayerRow[];regens:PlayerRow[];userClubId:string}|null>(null);
  const [error,setError] = useState("");

  useEffect(() => { fetch("/api/world/lifecycle",{cache:"no-store"}).then(async r => { const p=await r.json(); if(!r.ok) throw new Error(p.error); setData(p); }).catch(e=>setError(e.message)); }, []);

  const summary = useMemo(() => ({
    retirements: data?.events.filter(e=>e.event_type==="retired").length ?? 0,
    regens: data?.events.filter(e=>e.event_type==="regen_created").length ?? 0,
    progressions: data?.events.filter(e=>e.event_type==="progressed").length ?? 0,
    declines: data?.events.filter(e=>e.event_type==="declined").length ?? 0,
  }), [data]);

  return <div className="min-h-screen pitch-bg pb-28"><Nav /><main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
    <header className="mb-6"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-carmine-light">Monde vivant</p><h1 className="mt-1 font-display text-4xl md:text-5xl">Évolution des joueurs</h1><p className="mt-2 text-sm text-muted">Suis les progressions, déclins, retraites et nouveaux talents générés entre les saisons.</p></header>
    {error && <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-300">{error}</div>}
    {!data ? <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-6 text-muted">Chargement…</div> : <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Retraites" value={summary.retirements}/><Metric label="Nouveaux talents" value={summary.regens}/><Metric label="Progressions" value={summary.progressions}/><Metric label="Régressions" value={summary.declines}/></section>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <section className="rounded-3xl border border-white/10 bg-pitch-900/85 p-5"><h2 className="font-display text-2xl">Journal des transitions</h2><div className="mt-4 space-y-2">{data.events.map(event => <div key={event.id} className={`rounded-xl border p-3 ${event.club_id===data.userClubId?"border-carmine/40 bg-carmine/10":"border-white/10 bg-white/[0.03]"}`}><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{event.player_name}</p><p className="text-xs text-muted">{LABELS[event.event_type] ?? event.event_type}</p></div><span className="text-[10px] text-muted">{new Date(event.created_at).toLocaleDateString("fr-FR")}</span></div>{event.event_type!=="aged" && <p className="mt-2 text-xs text-zinc-300">{formatDetails(event)}</p>}</div>)}{!data.events.length && <p className="text-sm text-muted">Aucune transition enregistrée. Elles apparaîtront à la fin d’une saison.</p>}</div></section>
        <section className="space-y-5"><div className="rounded-3xl border border-white/10 bg-pitch-900/85 p-5"><h2 className="font-display text-2xl">Nouveaux talents</h2><div className="mt-4 space-y-2">{data.regens.map(p=><Player key={p.id} player={p} own={p.club_id===data.userClubId} extra={`Potentiel ${p.potential}`}/>)}{!data.regens.length&&<p className="text-sm text-muted">Aucun regen généré.</p>}</div></div><div className="rounded-3xl border border-white/10 bg-pitch-900/85 p-5"><h2 className="font-display text-2xl">Dernières retraites</h2><div className="mt-4 space-y-2">{data.retired.map(p=><Player key={p.id} player={p} own={false} extra={`${p.age} ans`}/>)}{!data.retired.length&&<p className="text-sm text-muted">Aucune retraite enregistrée.</p>}</div></div></section>
      </div>
    </>}
  </main></div>;
}

function Metric({label,value}:{label:string;value:number}) { return <div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-4"><p className="text-[10px] uppercase text-muted">{label}</p><p className="mt-1 font-display text-3xl">{value}</p></div>; }
function Player({player,own,extra}:{player:PlayerRow;own:boolean;extra:string}) { return <div className={`flex items-center justify-between rounded-xl border p-3 ${own?"border-carmine/40 bg-carmine/10":"border-white/10 bg-white/[0.03]"}`}><div><p className="text-sm font-semibold">{player.first_name} {player.last_name}</p><p className="text-[10px] text-muted">{player.club?.name ?? "Sans club"} · {player.position} · {extra}</p></div><span className="font-display text-xl">{player.overall}</span></div>; }
function formatDetails(event:EventRow) { const d=event.details??{}; if(event.event_type==="progressed"||event.event_type==="declined") return `GEN ${String(d.overall_before ?? "-")} → ${String(d.overall_after ?? "-")}`; if(event.event_type==="retired") return `${String(d.age ?? "-")} ans · GEN ${String(d.overall ?? "-")}`; if(event.event_type==="regen_created") return `GEN ${String(d.overall ?? "-")} · Potentiel ${String(d.potential ?? "-")}`; return ""; }
