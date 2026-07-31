"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

type Entry = { id:string; player_name:string; position:string|null; retirement_age:number|null; career_appearances:number; career_goals:number; career_assists:number; career_clean_sheets:number; individual_awards:number; legend_score:number; badges:string[]; club_id:string|null; club?:{name:string}|null };

export default function HallOfFamePage() {
  const [data,setData] = useState<any>(null);
  const [error,setError] = useState("");
  useEffect(() => { fetch("/api/hall-of-fame",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok) throw new Error(j.error);setData(j);}).catch(e=>setError(e.message)); },[]);
  return <div className="min-h-screen pitch-bg pb-28"><Nav/><main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
    <header className="mb-6"><p className="font-mono text-[10px] uppercase tracking-[.25em] text-gold">Panthéon</p><h1 className="mt-1 font-display text-4xl md:text-5xl">Hall of Fame</h1><p className="mt-2 text-sm text-muted">Les joueurs retraités qui ont laissé une trace durable.</p></header>
    {error && <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-rose-300">{error}</div>}
    {!data ? <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-6 text-muted">Chargement…</div> : <section className="grid gap-4 lg:grid-cols-2">{data.entries.map((e:Entry,index:number)=><article key={e.id} className={`rounded-3xl border p-5 ${e.club_id===data.clubId?"border-gold/40 bg-gold/5":"border-white/10 bg-pitch-900/85"}`}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.16em] text-muted">#{index+1} · {e.position ?? "Joueur"}</p><h2 className="mt-1 font-display text-3xl">{e.player_name}</h2><p className="mt-1 text-xs text-muted">{e.club?.name ?? "Club inconnu"}{e.retirement_age?` · Retraite à ${e.retirement_age} ans`:""}</p></div><div className="rounded-2xl bg-white/5 px-4 py-3 text-center"><p className="text-[9px] uppercase text-muted">Score légende</p><p className="font-display text-2xl text-gold">{e.legend_score}</p></div></div><div className="mt-5 grid grid-cols-5 gap-2 text-center"><Stat label="Matchs" value={e.career_appearances}/><Stat label="Buts" value={e.career_goals}/><Stat label="Passes" value={e.career_assists}/><Stat label="CS" value={e.career_clean_sheets}/><Stat label="Prix" value={e.individual_awards}/></div>{e.badges?.length>0&&<div className="mt-4 flex flex-wrap gap-2">{e.badges.map(b=><span key={b} className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[10px] text-gold">{b}</span>)}</div>}</article>)}{!data.entries.length&&<p className="text-sm text-muted">Aucune légende intronisée. Les premiers retraités éligibles apparaîtront après une fin de saison.</p>}</section>}
  </main></div>;
}
function Stat({label,value}:{label:string;value:number}) { return <div className="rounded-xl bg-white/5 p-2"><p className="text-[8px] uppercase text-muted">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>; }
