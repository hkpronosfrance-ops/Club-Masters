"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

type Youth = { id:string; first_name:string; last_name:string; nationality:string; age:number; position:string; strong_foot:string; height_cm:number; weight_kg:number; personality:string; overall:number; scout_label:string; scout_stars:number };
type Payload = { club:{ name:string; balance:number; academy_level:number; academy_next_intake_at:string|null }; players:Youth[]; upgradeCost:number; staff:{ academy_manager:number; scout:number }; staffEffects:{ intakeBonus:number; overallBonusChance:number; potentialBonus:number; cooldownDays:number } };

const money = (value:number) => new Intl.NumberFormat("fr-FR", { style:"currency", currency:"EUR", maximumFractionDigits:0 }).format(value);

export default function AcademyPage() {
  const [data,setData] = useState<Payload|null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState<string|null>(null);
  const [message,setMessage] = useState("");

  async function load() { setLoading(true); const res = await fetch("/api/academy", { cache:"no-store" }); const json = await res.json(); if (res.ok) setData(json); else setMessage(json.error ?? "Erreur de chargement"); setLoading(false); }
  useEffect(() => { void load(); }, []);

  async function act(action:string, playerId?:string) {
    setBusy(playerId ?? action); setMessage("");
    const res = await fetch("/api/academy", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ action, playerId }) });
    const json = await res.json();
    if (res.ok) { setData(json); setMessage(action === "promote" ? "Joueur promu en équipe première." : action === "upgrade" ? "Centre amélioré." : action === "intake" ? "Nouvelle promotion arrivée avec les bonus du staff." : "Joueur libéré."); }
    else setMessage(json.error ?? "Action impossible");
    setBusy(null);
  }

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Chargement du centre de formation…</div>;
  if (!data) return <main className="p-6 md:p-10 text-carmine-light">{message}</main>;

  const available = !data.club.academy_next_intake_at || new Date(data.club.academy_next_intake_at).getTime() <= Date.now();
  const stars = (n:number) => "★".repeat(n) + "☆".repeat(5-n);

  return <div className="min-h-screen pitch-bg pb-28 md:pb-10"><Nav /><main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10 space-y-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs uppercase tracking-[.25em] text-carmine-light">Détection et développement</p><h1 className="font-display text-3xl md:text-5xl">Centre de formation</h1><p className="mt-2 text-muted">Repère les futures stars et prépare l'avenir du club.</p></div><button disabled={!available || busy === "intake"} onClick={() => act("intake")} className="rounded-xl bg-carmine px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{available ? "Générer une promotion" : `Prochaine promotion : ${new Date(data.club.academy_next_intake_at!).toLocaleDateString("fr-FR")}`}</button></div>

    {message && <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">{message}</div>}

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Bonus label="Responsable académie" value={`Niv. ${data.staff.academy_manager}/10`} detail={`+${Math.round(data.staffEffects.overallBonusChance * 100)}% bonus de niveau`} />
      <Bonus label="Recruteur" value={`Niv. ${data.staff.scout}/10`} detail="Meilleure détection" />
      <Bonus label="Promotion" value={`+${data.staffEffects.intakeBonus} jeune(s)`} detail={`Potentiel +${data.staffEffects.potentialBonus}`} />
      <Bonus label="Nouvelle promotion" value={`${data.staffEffects.cooldownDays} jours`} detail={`${14 - data.staffEffects.cooldownDays} jour(s) gagné(s)`} />
    </section>

    <section className="grid gap-4 md:grid-cols-3"><div className="rounded-xl border border-white/10 bg-pitch-900/85 p-5"><p className="text-sm text-muted">Niveau du centre</p><p className="mt-1 text-3xl font-bold">{data.club.academy_level}<span className="text-base text-muted"> / 10</span></p></div><div className="rounded-xl border border-white/10 bg-pitch-900/85 p-5"><p className="text-sm text-muted">Jeunes présents</p><p className="mt-1 text-3xl font-bold">{data.players.length}</p></div><div className="rounded-xl border border-white/10 bg-pitch-900/85 p-5"><p className="text-sm text-muted">Budget du club</p><p className="mt-1 text-2xl font-bold">{money(data.club.balance)}</p></div></section>

    <section className="rounded-xl border border-white/10 bg-pitch-900/85 p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="font-display text-xl">Améliorer les infrastructures</h2><p className="text-sm text-muted">Plus de jeunes, de meilleurs potentiels et davantage de chances de trouver une pépite.</p></div><button disabled={data.club.academy_level >= 10 || data.club.balance < data.upgradeCost || busy === "upgrade"} onClick={() => act("upgrade")} className="rounded-xl border border-carmine px-4 py-2 text-carmine-light disabled:opacity-40">{data.club.academy_level >= 10 ? "Niveau maximum" : `Améliorer · ${money(data.upgradeCost)}`}</button></section>

    <section><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-2xl">Les jeunes du centre</h2><span className="text-xs text-muted">Le potentiel exact reste caché</span></div>{data.players.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-muted">Aucun jeune actuellement. Lance une nouvelle promotion.</div> : <div className="grid gap-4 lg:grid-cols-2">{data.players.map(player => <article key={player.id} className="rounded-xl border border-white/10 bg-pitch-900/85 p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="rounded bg-white/5 px-2 py-1 text-xs font-bold">{player.position}</span><span className="text-xs text-muted">{player.nationality}</span></div><h3 className="mt-2 font-display text-2xl">{player.first_name} {player.last_name}</h3><p className="text-sm text-muted">{player.age} ans · {player.height_cm} cm · {player.weight_kg} kg · Pied {player.strong_foot.toLowerCase()}</p></div><div className="rounded-lg bg-white/5 p-3 text-center"><p className="text-xs text-muted">Niveau</p><p className="text-2xl font-bold">{player.overall}</p></div></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-black/15 p-4"><div><p className="text-xs text-muted">Potentiel estimé</p><p className="text-lg text-amber-300">{stars(player.scout_stars)}</p><p className="text-sm font-semibold">{player.scout_label}</p></div><div><p className="text-xs text-muted">Personnalité</p><p className="mt-1 font-semibold">{player.personality}</p></div></div><div className="mt-4 flex gap-2"><button disabled={busy === player.id} onClick={() => act("promote",player.id)} className="flex-1 rounded bg-carmine px-4 py-2 font-semibold text-white disabled:opacity-40">Promouvoir</button><button disabled={busy === player.id} onClick={() => act("release",player.id)} className="rounded border border-white/10 px-4 py-2 text-muted hover:text-white disabled:opacity-40">Libérer</button></div></article>)}</div>}</section>
  </main></div>;
}

function Bonus({label,value,detail}:{label:string;value:string;detail:string}) { return <div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p><p className="mt-2 font-display text-2xl">{value}</p><p className="mt-1 text-xs text-emerald-300">{detail}</p></div>; }
