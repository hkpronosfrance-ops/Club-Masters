"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";

const FORMATIONS = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "5-3-2"];
const STYLES = [
  { value: "balanced", label: "Équilibré" },
  { value: "offensif", label: "Offensif" },
  { value: "defensif", label: "Défensif" },
  { value: "possession", label: "Possession" },
  { value: "contre", label: "Contre-attaque" },
];
const MATCH_TIMEOUT_MS = 90_000;

type Player = { id: string; first_name: string; last_name: string; position: string; overall: number; fatigue: number; form: number };
const money = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value ?? 0);
const number = (value: number) => new Intl.NumberFormat("fr-FR").format(value ?? 0);

export default function TacticsPage() {
  const supabase = createClient();
  const [club, setClub] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [starterIds, setStarterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
      if (!profile?.club_id) return;
      const [{ data: clubData }, { data: squad }] = await Promise.all([
        supabase.from("clubs").select("*").eq("id", profile.club_id).single(),
        supabase.from("players").select("id,first_name,last_name,position,overall,fatigue,form").eq("club_id", profile.club_id),
      ]);
      const sorted = [...(squad ?? [])].sort((a, b) => (b.overall - b.fatigue * 0.18) - (a.overall - a.fatigue * 0.18));
      setClub(clubData); setPlayers(sorted); setStarterIds(sorted.slice(0, 11).map((player) => player.id)); setLoading(false);
    })();
  }, []);

  const starters = useMemo(() => players.filter((player) => starterIds.includes(player.id)), [players, starterIds]);
  const averageOverall = starters.length ? Math.round(starters.reduce((sum, player) => sum + player.overall, 0) / starters.length) : 0;
  const tiredStarters = starters.filter((player) => player.fatigue >= 70).length;
  const hasGoalkeeper = starters.some((player) => player.position === "GK");
  const matchFinished = Boolean(matchResult);
  const canPlay = starterIds.length === 11 && hasGoalkeeper && !simulating && !matchFinished;

  async function updateClub(fields: Record<string, unknown>) {
    if (simulating || matchFinished) return;
    setClub((current: any) => ({ ...current, ...fields }));
    const { error: updateError } = await supabase.from("clubs").update(fields).eq("id", club.id);
    if (updateError) setError(updateError.message);
  }

  function toggleStarter(id: string) {
    if (simulating || matchFinished) return;
    setError(null);
    setStarterIds((current) => {
      if (current.includes(id)) return current.filter((playerId) => playerId !== id);
      if (current.length >= 11) { setError("Retire d'abord un titulaire avant d'en ajouter un autre."); return current; }
      return [...current, id];
    });
  }

  function autoSelect() {
    if (simulating || matchFinished) return;
    const goalkeeper = players.filter((player) => player.position === "GK").sort((a, b) => b.overall - a.overall)[0];
    const remaining = players.filter((player) => player.id !== goalkeeper?.id).sort((a, b) => (b.overall - b.fatigue * 0.2) - (a.overall - a.fatigue * 0.2));
    setStarterIds([...(goalkeeper ? [goalkeeper.id] : []), ...remaining.slice(0, goalkeeper ? 10 : 11).map((player) => player.id)]); setError(null);
  }

  async function playMatch() {
    if (!canPlay) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), MATCH_TIMEOUT_MS);
    setSimulating(true); setError(null);
    try {
      const response = await fetch("/api/match/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starterIds }), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "La simulation a échoué. Réessaie depuis la page Ligue.");
      setMatchResult(data);
      const reduction = Number(data.staffImpact?.fatigueGainReduction ?? 0);
      const recovery = Number(data.staffImpact?.recoveryBonus ?? 0);
      setPlayers((current) => current.map((player) => starterIds.includes(player.id)
        ? { ...player, fatigue: Math.min(100, player.fatigue + Math.max(6, 18 - reduction)) }
        : { ...player, fatigue: Math.max(0, player.fatigue - 4 - recovery) }));
    } catch (caught: unknown) {
      const message = caught instanceof DOMException && caught.name === "AbortError"
        ? "La simulation prend trop de temps. Vérifie la page Ligue avant de relancer afin d’éviter un doublon."
        : caught instanceof Error ? caught.message : "La rencontre n’a pas pu être lancée.";
      setError(message);
    } finally {
      window.clearTimeout(timeoutId);
      setSimulating(false);
    }
  }

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Préparation du vestiaire…</div>;

  return <div className="min-h-screen pitch-bg pb-28 md:pb-10"><Nav /><main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
    <section className="mb-5 rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-7"><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-carmine-light">Vestiaire · Jour de match</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-3xl font-semibold md:text-5xl">Composition & tactique</h1><p className="mt-2 text-sm text-muted">Choisis tes onze titulaires puis définis ton plan de jeu.</p></div><div className="grid grid-cols-3 gap-2 text-center"><Metric label="Titulaires" value={`${starterIds.length}/11`} /><Metric label="Note moy." value={String(averageOverall)} /><Metric label="Épuisés" value={String(tiredStarters)} /></div></div></section>
    {!matchFinished && <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl border border-white/10 bg-pitch-900/85 p-4 md:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Feuille de match</p><h2 className="mt-1 font-display text-2xl">Les 11 titulaires</h2></div><button onClick={autoSelect} disabled={simulating} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40">Sélection auto</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{players.map((player) => { const selected = starterIds.includes(player.id); return <button key={player.id} onClick={() => toggleStarter(player.id)} disabled={simulating} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-carmine/60 bg-carmine/10" : "border-white/8 bg-white/[0.03] hover:border-white/20"}`}><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-lg ${selected ? "bg-carmine text-white" : "bg-white/5 text-zinc-200"}`}>{player.overall}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{player.first_name} {player.last_name}</p><p className="mt-1 text-[10px] text-muted">{player.position} · Forme {player.form} · Fraîcheur {100 - player.fatigue}</p></div><span className={`text-lg ${selected ? "text-carmine-light" : "text-muted"}`}>{selected ? "✓" : "+"}</span></button>; })}</div></section>
      <section className="space-y-5"><div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Organisation</p><h2 className="mt-1 font-display text-2xl">Formation</h2><div className="mt-4 grid grid-cols-2 gap-2">{FORMATIONS.map((formation) => <button key={formation} disabled={simulating} onClick={() => updateClub({ formation })} className={`rounded-xl border px-3 py-3 font-mono text-sm disabled:opacity-40 ${club.formation === formation ? "border-carmine bg-carmine text-white" : "border-white/10 bg-white/5 text-muted"}`}>{formation}</button>)}</div><p className="mt-6 text-[10px] uppercase tracking-[0.18em] text-muted">Style de jeu</p><div className="mt-3 grid grid-cols-2 gap-2">{STYLES.map((style) => <button key={style.value} disabled={simulating} onClick={() => updateClub({ tactic_style: style.value })} className={`rounded-xl border px-3 py-3 text-sm disabled:opacity-40 ${club.tactic_style === style.value ? "border-carmine/50 bg-carmine/10 text-white" : "border-white/10 bg-white/5 text-muted"}`}>{style.label}</button>)}</div><div className="mt-6 flex items-center justify-between"><span className="text-sm text-muted">Mentalité</span><span className="font-mono text-sm">{club.mentality}</span></div><input type="range" min={0} max={100} value={club.mentality} disabled={simulating} onChange={(event) => updateClub({ mentality: Number(event.target.value) })} className="mt-3 w-full accent-carmine disabled:opacity-40" /></div>
        {!hasGoalkeeper && <Notice tone="amber">Ajoute au moins un gardien titulaire.</Notice>}{starterIds.length !== 11 && <Notice>Il manque {Math.max(0, 11 - starterIds.length)} titulaire(s).</Notice>}{tiredStarters > 0 && <Notice tone="rose">{tiredStarters} titulaire(s) ont une fatigue élevée.</Notice>}{error && <Notice tone="rose">{error}</Notice>}<button onClick={playMatch} disabled={!canPlay} className="w-full rounded-2xl bg-carmine px-5 py-4 font-display text-xl text-white transition hover:bg-carmine-light disabled:cursor-not-allowed disabled:opacity-40">{simulating ? "Le match est en cours…" : "Lancer la rencontre"}</button></section>
    </div>}
    {matchResult && <><MatchSummary data={matchResult} /><Link href="/league" className="mt-5 block w-full rounded-2xl bg-carmine px-5 py-4 text-center font-display text-xl text-white transition hover:bg-carmine-light">Continuer vers la journée suivante</Link></>}
  </main></div>;
}

function eventLabel(event: any) {
  if (event.commentary) return event.commentary;
  if (event.type === "kickoff") return "Coup d’envoi de la rencontre.";
  if (event.type === "half_time") return "Mi-temps.";
  if (event.type === "full_time") return "Fin du match.";
  if (event.type === "tactical_change") return "Ajustement tactique.";
  const primary = event.playerName?.trim();
  const secondary = event.secondaryPlayerName?.trim();
  if (event.type === "substitution" && primary && secondary) return `${primary} remplace ${secondary}.`;
  return primary || "Événement de match";
}

function eventIcon(type: string) {
  if (type === "substitution") return "🔄";
  if (type === "yellow") return "🟨";
  if (type === "red") return "🟥";
  if (type === "save") return "🧤";
  if (type === "injury") return "🩹";
  if (type === "tactical_change") return "🧠";
  return type === "goal" ? "⚽" : "•";
}

function MatchSummary({ data }: { data: any }) {
  const staff = data.staffImpact ?? {};
  return <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-pitch-900/90"><div className="bg-black/15 px-5 py-6 text-center"><p className="text-[10px] uppercase tracking-[0.2em] text-muted">Score final</p><div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><span className="font-display text-lg">{data.home.name}</span><span className="font-display text-4xl font-bold md:text-6xl">{data.result.homeScore} - {data.result.awayScore}</span><span className="font-display text-lg">{data.away.name}</span></div><p className="mt-3 font-mono text-xs text-gold">Prime {money(data.matchBonus)} · Recettes stade {money(data.stadiumRevenue)}</p></div>
    <div className="grid gap-4 p-5 lg:grid-cols-2"><div><h3 className="font-display text-xl">Bilan du match</h3><div className="mt-3 grid grid-cols-2 gap-2"><ResultMetric label="Spectateurs" value={data.attendance ? number(data.attendance.spectators) : "Extérieur"} /><ResultMetric label="Ambiance" value={data.attendance ? `${data.attendance.atmosphere}/100` : "—"} /><ResultMetric label="Billetterie" value={money(data.attendance?.ticketRevenue ?? 0)} /><ResultMetric label="VIP" value={money(data.attendance?.vipRevenue ?? 0)} /><ResultMetric label="Restauration" value={money(data.attendance?.cateringRevenue ?? 0)} /><ResultMetric label="Boutique" value={money(data.attendance?.merchandiseRevenue ?? 0)} /></div></div>
      <div><h3 className="font-display text-xl">Impact du staff médical</h3><div className="mt-3 grid grid-cols-2 gap-2"><ResultMetric label="Médecin" value={`Niv. ${staff.doctorLevel ?? 0}`} /><ResultMetric label="Préparateur" value={`Niv. ${staff.fitnessCoachLevel ?? 0}`} /><ResultMetric label="Risque évité" value={`-${staff.injuryReductionPercent ?? 0}%`} /><ResultMetric label="Fatigue économisée" value={`${staff.fatigueGainReduction ?? 0} pts`} /><ResultMetric label="Récupération banc" value={`+${staff.recoveryBonus ?? 0} pts`} /><ResultMetric label="Blessures" value={String(data.injuries?.length ?? 0)} /></div>{data.injuries?.length > 0 && <div className="mt-3 space-y-2">{data.injuries.map((injury: any) => <div key={injury.id} className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">{injury.name} · {injury.type} · {injury.days} jour(s)</div>)}</div>}</div>
    </div><div className="border-t border-white/10 p-5"><h3 className="font-display text-xl">Temps forts</h3><div className="mt-3 space-y-2">{data.result.events.map((event: any, index: number) => <div key={`${event.minute}-${index}`} className="flex items-start gap-3 rounded-xl bg-white/5 px-3 py-3 text-sm"><span className="w-10 shrink-0 font-mono text-muted">{event.minute}&apos;</span><span>{eventIcon(event.type)}</span><span>{eventLabel(event)}</span></div>)}{!data.result.events.length && <p className="rounded-xl bg-white/5 p-4 text-center text-sm text-muted">Aucun événement majeur dans cette rencontre.</p>}</div></div></section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><p className="text-[8px] uppercase tracking-wide text-muted">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>; }
function ResultMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/5 p-3"><p className="text-[9px] uppercase tracking-wide text-muted">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>; }
function Notice({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "amber" | "rose" }) { const classes = tone === "amber" ? "border-amber-400/20 bg-amber-500/10 text-amber-300" : tone === "rose" ? "border-rose-400/20 bg-rose-500/10 text-rose-300" : "border-white/10 bg-white/5 text-muted"; return <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>{children}</div>; }
