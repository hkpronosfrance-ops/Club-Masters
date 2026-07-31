"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";

const PROGRAMS = [
  { value: "pace", label: "Vitesse", icon: "⚡" },
  { value: "shooting", label: "Tir", icon: "🎯" },
  { value: "passing", label: "Passe", icon: "🧠" },
  { value: "defending", label: "Défense", icon: "🛡️" },
  { value: "physical", label: "Physique", icon: "💪" },
];
const INTENSITIES = [
  { value: "light", label: "Légère", fatigue: "+4 fatigue", delay: "8 h" },
  { value: "normal", label: "Normale", fatigue: "+8 fatigue", delay: "12 h" },
  { value: "intense", label: "Intense", fatigue: "+14 fatigue", delay: "18 h" },
];

export default function TrainingPage() {
  const [data, setData] = useState<any>(null);
  const [program, setProgram] = useState("passing");
  const [intensity, setIntensity] = useState("normal");
  const [targets, setTargets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);

  async function load() {
    const response = await fetch("/api/training", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Impossible de charger l'entraînement.");
    setData(payload);
  }

  useEffect(() => { load().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);

  const nextTrainingAt = useMemo(() => {
    if (!data?.club?.last_training_at) return null;
    const hours = intensity === "light" ? 8 : intensity === "intense" ? 18 : 12;
    return new Date(new Date(data.club.last_training_at).getTime() + hours * 3_600_000);
  }, [data, intensity]);
  const available = !nextTrainingAt || nextTrainingAt.getTime() <= Date.now();

  function toggleTarget(id: string) {
    setTargets((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 5 ? current : [...current, id]);
  }

  async function train() {
    setRunning(true); setError(null); setReport(null);
    try {
      const response = await fetch("/api/training", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ program, intensity, targetedPlayerIds: targets }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "La séance a échoué.");
      setReport(payload);
      setTargets([]);
      await load();
    } catch (e: any) { setError(e.message); } finally { setRunning(false); }
  }

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Ouverture du centre d'entraînement…</div>;

  return <div className="min-h-screen pitch-bg pb-28 md:pb-10"><Nav /><main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
    <section className="rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-7"><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-carmine-light">Performance</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-3xl font-semibold md:text-5xl">Centre d'entraînement</h1><p className="mt-2 text-sm text-muted">Développe les joueurs sans épuiser ton effectif.</p></div><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right"><p className="text-[9px] uppercase text-muted">Prochaine séance</p><p className="mt-1 font-mono text-sm">{available ? "Disponible" : nextTrainingAt?.toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</p></div></div></section>
    {error && <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}
    <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="space-y-5"><div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Programme collectif</p><div className="mt-4 grid grid-cols-2 gap-2">{PROGRAMS.map((item) => <button key={item.value} onClick={() => setProgram(item.value)} className={`rounded-xl border p-3 text-left ${program === item.value ? "border-carmine bg-carmine/10" : "border-white/10 bg-white/5"}`}><span className="mr-2">{item.icon}</span>{item.label}</button>)}</div><p className="mt-6 text-[10px] uppercase tracking-[0.18em] text-muted">Intensité</p><div className="mt-3 space-y-2">{INTENSITIES.map((item) => <button key={item.value} onClick={() => setIntensity(item.value)} className={`flex w-full items-center justify-between rounded-xl border p-3 ${intensity === item.value ? "border-carmine bg-carmine/10" : "border-white/10 bg-white/5"}`}><span>{item.label}</span><span className="text-xs text-muted">{item.fatigue} · délai {item.delay}</span></button>)}</div><button onClick={train} disabled={!available || running} className="mt-5 w-full rounded-xl bg-carmine px-4 py-4 font-display text-lg text-white disabled:opacity-40">{running ? "Séance en cours…" : available ? "Lancer la séance" : "Récupération en cours"}</button></div>
      <div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Historique</p><div className="mt-3 space-y-2">{data?.history?.map((session: any) => <div key={session.id} className="rounded-xl bg-white/5 p-3"><div className="flex justify-between text-sm"><span className="capitalize">{session.program} · {session.intensity}</span><span className="text-muted">{new Date(session.created_at).toLocaleDateString("fr-FR")}</span></div><p className="mt-1 text-xs text-muted">{session.results?.filter((r: any) => r.statGain || r.overallGain).length ?? 0} progression(s)</p></div>)}{!data?.history?.length && <p className="text-sm text-muted">Aucune séance enregistrée.</p>}</div></div></section>
      <section className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5"><div className="flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Travail individuel</p><h2 className="mt-1 font-display text-2xl">Joueurs ciblés</h2></div><span className="font-mono text-sm text-muted">{targets.length}/5</span></div><p className="mt-2 text-xs text-muted">Les joueurs ciblés progressent plus vite, avec un léger surplus de fatigue.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{data?.players?.map((player: any) => { const selected = targets.includes(player.id); const injured = player.injured_until && new Date(player.injured_until).getTime() > Date.now(); return <button key={player.id} disabled={injured} onClick={() => toggleTarget(player.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selected ? "border-carmine bg-carmine/10" : "border-white/10 bg-white/[0.03]"} disabled:opacity-40`}><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 font-display text-lg">{player.overall}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{player.first_name} {player.last_name}</p><p className="mt-1 text-[10px] text-muted">{player.age} ans · Pot. {player.potential} · Fatigue {player.fatigue}</p></div><span>{selected ? "✓" : "+"}</span></button>; })}</div></section>
    </div>
    {report && <section className="mt-5 rounded-2xl border border-carmine/30 bg-carmine/10 p-5"><h2 className="font-display text-2xl">Rapport de séance</h2><div className="mt-3 grid gap-2 md:grid-cols-2">{report.results?.map((item: any) => <div key={item.playerId} className="rounded-xl bg-black/15 p-3 text-sm"><span className="font-semibold">{item.name}</span><span className="ml-2 text-muted">{item.overallGain ? `+${item.overallGain} GEN` : item.statGain ? "+1 statistique" : "travail ciblé"}{item.injury ? ` · ${item.injury.type} (${item.injury.days} j)` : ""}</span></div>)}</div></section>}
  </main></div>;
}
