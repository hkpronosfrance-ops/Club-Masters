"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";

function money(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M€`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} k€`;
  return `${value} €`;
}

export default function NegotiationsPage() {
  const supabase = createClient();
  const [players, setPlayers] = useState<any[]>([]);
  const [negotiations, setNegotiations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ transferFee: 0, wageOffer: 0, signingBonus: 0, contractYears: 3 });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
    if (!profile?.club_id) return;
    const [{ data: market }, response] = await Promise.all([
      supabase.from("players").select("*, clubs!players_club_id_fkey(name)").eq("is_listed", true).neq("club_id", profile.club_id).limit(100),
      fetch("/api/transfer/negotiations"),
    ]);
    const payload = await response.json();
    setPlayers(market ?? []);
    setNegotiations(payload.negotiations ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function choose(player: any) {
    setSelected(player);
    setForm({
      transferFee: Number(player.listed_price ?? player.value),
      wageOffer: Math.max(Number(player.wage ?? 1000), Math.round(Number(player.value ?? 0) / 260)),
      signingBonus: Math.round(Number(player.wage ?? 1000) * 4),
      contractYears: 3,
    });
  }

  async function submit() {
    if (!selected) return;
    setMessage("");
    const response = await fetch("/api/transfer/negotiations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: selected.id, ...form }),
    });
    const payload = await response.json();
    setMessage(response.ok ? payload.negotiation.club_response : payload.error);
    if (response.ok) { setSelected(null); await load(); }
  }

  async function act(id: string, action: string) {
    const response = await fetch("/api/transfer/negotiations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    const payload = await response.json();
    setMessage(response.ok ? (action === "complete" ? "Transfert finalisé." : "Négociation annulée.") : payload.error);
    await load();
  }

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Chargement des négociations…</div>;

  return <div className="min-h-screen pitch-bg pb-28"><Nav /><main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-carmine-light">Mercato V2</p><h1 className="font-display text-3xl md:text-5xl">Salle des négociations</h1><p className="mt-2 max-w-2xl text-sm text-muted">Négocie l'indemnité, le salaire, la prime à la signature et la durée du contrat.</p></div>
    </div>
    {message && <div className="mb-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">{message}</div>}

    <section className="mb-8"><h2 className="mb-3 font-display text-2xl">Dossiers en cours</h2><div className="grid gap-3 lg:grid-cols-2">
      {negotiations.length === 0 && <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-5 text-sm text-muted">Aucune négociation en cours.</div>}
      {negotiations.map((n) => <article key={n.id} className="rounded-2xl border border-white/10 bg-pitch-900/90 p-4">
        <div className="flex justify-between gap-3"><div><h3 className="font-semibold">{n.player?.first_name} {n.player?.last_name}</h3><p className="text-xs text-muted">{n.seller?.name} · {n.player?.position} · GEN {n.player?.overall}</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase">{n.status}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><Metric label="Offre" value={money(n.transfer_fee)} /><Metric label="Salaire" value={money(n.wage_offer)} />{n.counter_fee && <Metric label="Contre-offre" value={money(n.counter_fee)} />}{n.counter_wage && <Metric label="Salaire demandé" value={money(n.counter_wage)} />}</div>
        <p className="mt-3 text-xs leading-5 text-muted">{n.club_response}</p>
        <div className="mt-4 flex gap-2">{["accepted","countered"].includes(n.status) && <button onClick={() => act(n.id,"complete")} className="rounded-lg bg-carmine px-3 py-2 text-xs font-semibold">Finaliser</button>}{!["completed","cancelled","rejected"].includes(n.status) && <button onClick={() => act(n.id,"cancel")} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Annuler</button>}</div>
      </article>)}
    </div></section>

    <section><h2 className="mb-3 font-display text-2xl">Joueurs disponibles</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {players.map((p) => <button key={p.id} onClick={() => choose(p)} className="rounded-2xl border border-white/10 bg-pitch-900/90 p-4 text-left hover:border-carmine/50"><div className="flex justify-between"><div><h3 className="font-semibold">{p.first_name} {p.last_name}</h3><p className="text-xs text-muted">{p.clubs?.name} · {p.age} ans</p></div><div className="font-display text-2xl">{p.overall}</div></div><div className="mt-3 flex justify-between text-xs"><span>{p.position}</span><span className="text-gold">{money(p.listed_price ?? p.value)}</span></div></button>)}
    </div></section>
  </main>

  {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center"><div className="w-full max-w-lg rounded-3xl border border-white/10 bg-pitch-900 p-5"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-carmine-light">Nouvelle offre</p><h2 className="mt-2 font-display text-3xl">{selected.first_name} {selected.last_name}</h2><div className="mt-5 grid grid-cols-2 gap-3"><Field label="Indemnité" value={form.transferFee} onChange={(v) => setForm({...form,transferFee:v})}/><Field label="Salaire annuel" value={form.wageOffer} onChange={(v) => setForm({...form,wageOffer:v})}/><Field label="Prime de signature" value={form.signingBonus} onChange={(v) => setForm({...form,signingBonus:v})}/><label className="text-xs text-muted">Durée<select value={form.contractYears} onChange={(e)=>setForm({...form,contractYears:Number(e.target.value)})} className="field-input mt-1 w-full">{[1,2,3,4,5].map(y=><option key={y} value={y}>{y} an{y>1?"s":""}</option>)}</select></label></div><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={()=>setSelected(null)} className="rounded-xl border border-white/10 px-4 py-3 text-sm">Retour</button><button onClick={submit} className="rounded-xl bg-carmine px-4 py-3 text-sm font-semibold">Envoyer l'offre</button></div></div></div>}
  </div>;
}

function Field({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}) { return <label className="text-xs text-muted">{label}<input type="number" min="0" value={value} onChange={(e)=>onChange(Number(e.target.value))} className="field-input mt-1 w-full" /></label>; }
function Metric({label,value}:{label:string;value:string}) { return <div className="rounded-lg bg-white/5 p-2"><p className="text-[9px] uppercase text-muted">{label}</p><p className="mt-1 font-mono">{value}</p></div>; }
