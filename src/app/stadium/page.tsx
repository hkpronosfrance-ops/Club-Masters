"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

type StadiumData = {
  stadium: { name: string; capacity: number; pitch_quality: number; vip_level: number; shop_level: number; catering_level: number; parking_level: number; ticket_price: number } | null;
  fans: { supporters: number; season_ticket_holders: number; loyalty: number; passion: number; expectation: number; satisfaction: number; local_popularity: number; national_popularity: number; international_popularity: number } | null;
  attendance: Array<{ id: string; attendance: number; atmosphere: number; ticket_revenue: number; created_at: string }>;
  reactions: Array<{ id: string; sentiment: string; message: string; created_at: string }>;
  forecast: { attendance: number; revenue: number };
};

const money = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

export default function StadiumPage() {
  const [data, setData] = useState<StadiumData | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("24");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/stadium", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error ?? "Impossible de charger le stade.");
    setData(payload);
    setName(payload.stadium?.name ?? "Dynasty Arena");
    setPrice(String(payload.stadium?.ticket_price ?? 24));
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    setMessage("");
    const response = await fetch("/api/stadium", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stadiumName: name, ticketPrice: Number(price) }) });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error ?? "Modification impossible.");
    setData(payload);
    setMessage("Paramètres du stade enregistrés.");
  }

  return <div className="min-h-screen pitch-bg pb-28 md:pb-10"><Nav /><main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
    <header className="mb-6"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-carmine-light">Supporters & Stade</p><h1 className="mt-1 font-display text-4xl">{data?.stadium?.name ?? "Stade"}</h1><p className="mt-2 text-sm text-muted">Pilote l’affluence, l’ambiance et les revenus des jours de match.</p></header>
    {message && <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{message}</div>}
    {!data ? <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-6 text-muted">Chargement…</div> : <>
      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Capacité" value={number(data.stadium?.capacity ?? 0)} />
        <Card label="Prévision affluence" value={number(data.forecast.attendance)} />
        <Card label="Recette estimée" value={money(data.forecast.revenue)} />
        <Card label="Satisfaction" value={`${data.fans?.satisfaction ?? 0}/100`} />
      </section>
      <section className="mb-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5"><h2 className="font-display text-2xl">Gestion du stade</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm text-muted">Nom du stade<input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white" /></label><label className="text-sm text-muted">Prix moyen du billet<input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="5" max="500" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white" /></label></div><button onClick={save} className="mt-4 rounded-xl bg-carmine px-4 py-3 text-sm font-semibold">Enregistrer</button><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"><Level label="Pelouse" value={data.stadium?.pitch_quality ?? 1} /><Level label="VIP" value={data.stadium?.vip_level ?? 1} /><Level label="Boutique" value={data.stadium?.shop_level ?? 1} /><Level label="Restauration" value={data.stadium?.catering_level ?? 1} /><Level label="Parking" value={data.stadium?.parking_level ?? 1} /></div></div>
        <div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5"><h2 className="font-display text-2xl">Communauté</h2><div className="mt-4 space-y-3"><Gauge label="Supporters" value={Math.min(100, Math.round((data.fans?.supporters ?? 0) / 1000))} text={number(data.fans?.supporters ?? 0)} /><Gauge label="Fidélité" value={data.fans?.loyalty ?? 0} /><Gauge label="Passion" value={data.fans?.passion ?? 0} /><Gauge label="Exigence" value={data.fans?.expectation ?? 0} /><Gauge label="Popularité nationale" value={data.fans?.national_popularity ?? 0} /></div></div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5"><h2 className="font-display text-2xl">Dernières affluences</h2><div className="mt-4 space-y-2">{data.attendance.length === 0 ? <p className="text-sm text-muted">Aucune rencontre enregistrée.</p> : data.attendance.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl bg-white/5 p-3 text-sm"><span>{number(item.attendance)} spectateurs</span><span className="text-muted">Ambiance {item.atmosphere}/100</span><span>{money(item.ticket_revenue)}</span></div>)}</div></div><div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5"><h2 className="font-display text-2xl">Voix des supporters</h2><div className="mt-4 space-y-2">{data.reactions.length === 0 ? <p className="text-sm text-muted">Les premières réactions apparaîtront après les matchs.</p> : data.reactions.map((item) => <div key={item.id} className="rounded-xl bg-white/5 p-3 text-sm"><span className={item.sentiment === "positive" ? "text-emerald-300" : item.sentiment === "negative" ? "text-rose-300" : "text-amber-300"}>●</span> <span className="ml-2">{item.message}</span></div>)}</div></div></section>
    </>}
  </main></div>;
}

function Card({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p><p className="mt-2 font-display text-2xl">{value}</p></div>; }
function Level({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 font-display text-xl">Niveau {value}</p></div>; }
function Gauge({ label, value, text }: { label: string; value: number; text?: string }) { const safe = Math.max(0, Math.min(100, value)); return <div><div className="mb-1 flex justify-between text-xs"><span className="text-muted">{label}</span><span>{text ?? `${safe}/100`}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-carmine" style={{ width: `${safe}%` }} /></div></div>; }
