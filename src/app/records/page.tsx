"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

type RecordRow = { id:string; record_label:string; holder_name:string; value_label:string|null; holder_club_id:string|null; record_value:number };

export default function RecordsPage() {
  const [data,setData] = useState<any>(null);
  const [error,setError] = useState("");
  useEffect(() => { fetch("/api/records",{cache:"no-store"}).then(async r => { const j=await r.json(); if(!r.ok) throw new Error(j.error); setData(j); }).catch(e=>setError(e.message)); },[]);
  return <div className="min-h-screen pitch-bg pb-28"><Nav/><main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
    <header className="mb-6"><p className="font-mono text-[10px] uppercase tracking-[.25em] text-carmine-light">Mémoire du football</p><h1 className="mt-1 font-display text-4xl md:text-5xl">Records historiques</h1><p className="mt-2 text-sm text-muted">Les performances qui ont marqué durablement le monde du jeu.</p></header>
    {error && <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-300">{error}</div>}
    {!data ? <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-6 text-muted">Chargement…</div> : <>
      {data.honours && <section className="mb-6 grid gap-3 sm:grid-cols-3"><Metric label="Titres" value={data.honours.league_titles}/><Metric label="Saisons" value={data.honours.seasons_played}/><Metric label="Victoires" value={data.honours.total_wins}/></section>}
      <section className="grid gap-3 md:grid-cols-2">{data.records.map((r:RecordRow) => <article key={r.id} className={`rounded-2xl border p-5 ${r.holder_club_id===data.clubId?"border-carmine/40 bg-carmine/10":"border-white/10 bg-pitch-900/85"}`}><p className="text-[10px] uppercase tracking-[.18em] text-muted">{r.record_label}</p><h2 className="mt-2 font-display text-2xl">{r.holder_name}</h2><p className="mt-2 font-mono text-gold">{r.value_label ?? r.record_value}</p></article>)}{!data.records.length && <p className="text-sm text-muted">Les premiers records seront créés à la prochaine fin de saison.</p>}</section>
    </>}
  </main></div>;
}
function Metric({label,value}:{label:string;value:number}) { return <div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-4"><p className="text-[10px] uppercase text-muted">{label}</p><p className="mt-1 font-display text-3xl">{value}</p></div>; }
