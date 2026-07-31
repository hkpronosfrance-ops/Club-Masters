"use client";

import { useEffect, useMemo, useState } from "react";

const personalityLabels: Record<string, string> = {
  business: "Business", loyal: "Loyal", protective: "Protecteur", ambitious: "Ambitieux", opportunist: "Opportuniste",
};

type Player = { id:string; first_name:string; last_name:string; position:string; overall:number; wage:number; morale:number; agent:any };

export default function AgentsPage() {
  const [data, setData] = useState<any>({ players: [], relationships: [], messages: [], negotiations: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Player | null>(null);
  const [salary, setSalary] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [years, setYears] = useState(3);
  const [role, setRole] = useState("rotation");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/agents", { cache: "no-store" });
    const json = await res.json();
    setData(json);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const agents = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of data.players ?? []) if (p.agent) {
      const current = map.get(p.agent.id) ?? { ...p.agent, players: [] };
      current.players.push(p); map.set(p.agent.id, current);
    }
    return [...map.values()];
  }, [data.players]);

  function openNegotiation(p: Player) {
    setSelected(p); setSalary(Math.round((p.wage || 1000) * 1.15)); setBonus(Math.round((p.wage || 1000) * 12)); setYears(3); setRole("rotation"); setNotice("");
  }

  async function negotiate() {
    if (!selected) return;
    const res = await fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: selected.id, type: "renewal", salary, signingBonus: bonus, contractYears: years, promisedRole: role }) });
    const json = await res.json();
    setNotice(json.response ?? json.error ?? "Réponse enregistrée.");
    await load();
  }

  if (loading) return <main className="p-6 md:p-10 text-white">Chargement du réseau d'agents...</main>;

  return <main className="p-5 md:p-10 pb-28 text-white max-w-7xl mx-auto">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div><p className="text-carmine-light text-xs uppercase tracking-[.25em]">Mercato & contrats</p><h1 className="font-display text-3xl md:text-5xl">Agents de joueurs</h1><p className="text-muted mt-2">Construis ton réseau, négocie les contrats et protège l'équilibre du vestiaire.</p></div>
      <div className="rounded-xl border border-pitch-700 bg-pitch-800 px-5 py-3"><span className="text-muted text-xs">Réseau actif</span><div className="text-2xl font-semibold">{agents.length} agents</div></div>
    </div>

    <section className="grid lg:grid-cols-3 gap-5 mb-8">
      {agents.map((a:any) => {
        const rel = data.relationships.find((r:any) => r.agent_id === a.id)?.relationship ?? 50;
        return <article key={a.id} className="rounded-2xl border border-pitch-700 bg-pitch-800/80 p-5">
          <div className="flex justify-between gap-3"><div><h2 className="font-display text-xl">{a.first_name} {a.last_name}</h2><p className="text-sm text-muted">{a.nationality} · {personalityLabels[a.personality]}</p></div><span className="text-carmine-light font-semibold">{a.commission_rate}%</span></div>
          <div className="grid grid-cols-3 gap-2 my-4 text-center"><div className="bg-pitch-900 rounded-lg p-2"><div className="text-xs text-muted">Réputation</div><b>{a.reputation}</b></div><div className="bg-pitch-900 rounded-lg p-2"><div className="text-xs text-muted">Difficulté</div><b>{a.difficulty}</b></div><div className="bg-pitch-900 rounded-lg p-2"><div className="text-xs text-muted">Relation</div><b>{rel}</b></div></div>
          <p className="text-xs uppercase tracking-wide text-muted mb-2">Joueurs représentés</p>
          <div className="space-y-2">{a.players.map((p:Player) => <button key={p.id} onClick={() => openNegotiation(p)} className="w-full flex justify-between items-center text-left rounded-lg bg-pitch-900 hover:bg-pitch-700 px-3 py-2"><span>{p.first_name} {p.last_name}<small className="block text-muted">{p.position} · GEN {p.overall}</small></span><span className="text-xs text-carmine-light">Négocier</span></button>)}</div>
        </article>;
      })}
    </section>

    <section className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-2xl border border-pitch-700 bg-pitch-800 p-5"><h2 className="font-display text-2xl mb-4">Négociations récentes</h2><div className="space-y-3">{(data.negotiations ?? []).length === 0 && <p className="text-muted">Aucune discussion contractuelle.</p>}{(data.negotiations ?? []).map((n:any) => <div key={n.id} className="rounded-xl bg-pitch-900 p-4"><div className="flex justify-between"><b>{n.player?.first_name} {n.player?.last_name}</b><span className={n.status === "accepted" ? "text-green-400" : n.status === "countered" ? "text-yellow-300" : "text-red-400"}>{n.status}</span></div><p className="text-sm text-muted mt-1">{n.agent_response}</p><p className="text-xs mt-2">{Number(n.salary).toLocaleString("fr-FR")} €/sem. · {n.contract_years} ans · rôle {n.promised_role}</p></div>)}</div></div>
      <div className="rounded-2xl border border-pitch-700 bg-pitch-800 p-5"><h2 className="font-display text-2xl mb-4">Boîte de réception</h2><div className="space-y-3">{(data.messages ?? []).length === 0 && <p className="text-muted">Aucun message urgent de la part des agents.</p>}{(data.messages ?? []).map((m:any) => <div key={m.id} className="rounded-xl bg-pitch-900 p-4"><p className="text-xs text-carmine-light">{m.agent?.first_name} {m.agent?.last_name}</p><b>{m.subject}</b><p className="text-sm text-muted mt-1">{m.body}</p></div>)}</div></div>
    </section>

    {selected && <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-4"><div className="w-full max-w-xl rounded-2xl bg-pitch-800 border border-pitch-600 p-6"><div className="flex justify-between"><div><p className="text-carmine-light text-xs uppercase">Prolongation</p><h2 className="font-display text-2xl">{selected.first_name} {selected.last_name}</h2><p className="text-muted text-sm">Agent : {selected.agent.first_name} {selected.agent.last_name}</p></div><button onClick={() => setSelected(null)} className="text-muted">✕</button></div><div className="grid sm:grid-cols-2 gap-4 mt-5"><label className="text-sm">Salaire hebdomadaire<input type="number" value={salary} onChange={e=>setSalary(Number(e.target.value))} className="mt-1 w-full bg-pitch-900 border border-pitch-600 rounded-lg p-3" /></label><label className="text-sm">Prime à la signature<input type="number" value={bonus} onChange={e=>setBonus(Number(e.target.value))} className="mt-1 w-full bg-pitch-900 border border-pitch-600 rounded-lg p-3" /></label><label className="text-sm">Durée<select value={years} onChange={e=>setYears(Number(e.target.value))} className="mt-1 w-full bg-pitch-900 border border-pitch-600 rounded-lg p-3">{[1,2,3,4,5].map(y=><option key={y} value={y}>{y} ans</option>)}</select></label><label className="text-sm">Rôle promis<select value={role} onChange={e=>setRole(e.target.value)} className="mt-1 w-full bg-pitch-900 border border-pitch-600 rounded-lg p-3"><option value="star">Star</option><option value="important">Important</option><option value="rotation">Rotation</option><option value="prospect">Espoir</option></select></label></div>{notice && <p className="mt-4 rounded-lg bg-pitch-900 p-3 text-sm">{notice}</p>}<button onClick={negotiate} className="mt-5 w-full rounded-lg bg-carmine hover:bg-carmine-light py-3 font-semibold">Envoyer l'offre à l'agent</button></div></div>}
  </main>;
}
