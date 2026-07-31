"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";

type MatchEvent = {
  minute: number;
  type: string;
  team: "home" | "away";
  playerName?: string;
  commentary?: string;
  xg?: number;
};

const ICONS: Record<string, string> = {
  kickoff: "▶️",
  goal: "⚽",
  chance: "🎯",
  chance_missed: "↗️",
  save: "🧤",
  yellow: "🟨",
  red: "🟥",
  corner: "🚩",
  free_kick: "🥅",
  penalty: "⭕",
  offside: "🚫",
  injury: "🩹",
  substitution: "🔁",
  tactical_change: "🧠",
  half_time: "⏸️",
  full_time: "🏁",
};

export default function MatchLivePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [minute, setMinute] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetch("/api/match/latest")
      .then((response) => response.json())
      .then((payload) => {
        setData(payload.match);
        setMinute(0);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!playing || minute >= 90) return;
    const timer = window.setInterval(() => {
      setMinute((current) => {
        const next = Math.min(90, current + 1);
        if (next >= 90) setPlaying(false);
        return next;
      });
    }, Math.max(120, 900 / speed));
    return () => window.clearInterval(timer);
  }, [playing, speed, minute]);

  const events: MatchEvent[] = useMemo(() => Array.isArray(data?.events) ? [...data.events].sort((a, b) => a.minute - b.minute) : [], [data]);
  const visibleEvents = events.filter((event) => event.minute <= minute);
  const homeGoals = visibleEvents.filter((event) => event.type === "goal" && event.team === "home").length;
  const awayGoals = visibleEvents.filter((event) => event.type === "goal" && event.team === "away").length;
  const homeShots = visibleEvents.filter((event) => ["goal", "chance", "chance_missed", "save"].includes(event.type) && event.team === "home").length;
  const awayShots = visibleEvents.filter((event) => ["goal", "chance", "chance_missed", "save"].includes(event.type) && event.team === "away").length;
  const homeXg = visibleEvents.filter((event) => event.team === "home").reduce((sum, event) => sum + Number(event.xg ?? 0), 0);
  const awayXg = visibleEvents.filter((event) => event.team === "away").reduce((sum, event) => sum + Number(event.xg ?? 0), 0);
  const totalStrength = Math.max(1, Number(data?.home_strength ?? 100) + Number(data?.away_strength ?? 100));
  const homePossession = Math.round(Number(data?.home_strength ?? 100) / totalStrength * 100);

  function restart() {
    setMinute(0);
    setPlaying(true);
  }

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Chargement du stade…</div>;

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <section className="rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-carmine-light">Match Live · Replay</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="font-display text-3xl font-semibold md:text-5xl">Centre de match</h1><p className="mt-2 text-sm text-muted">Revis le dernier match minute par minute.</p></div>
            <div className="flex gap-2">{[1, 2, 4].map((value) => <button key={value} onClick={() => setSpeed(value)} className={`rounded-xl border px-3 py-2 font-mono text-xs ${speed === value ? "border-carmine bg-carmine text-white" : "border-white/10 bg-white/5 text-muted"}`}>×{value}</button>)}</div>
          </div>
        </section>

        {!data ? <section className="mt-5 rounded-2xl border border-white/10 bg-pitch-900/85 p-8 text-center text-muted">Aucun match joué pour le moment.</section> : <>
          <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-pitch-900/90">
            <div className="relative bg-emerald-950/70 px-5 py-8">
              <div className="absolute inset-4 rounded-2xl border border-white/15" />
              <div className="absolute left-1/2 top-4 bottom-4 border-l border-white/15" />
              <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                <div><p className="font-display text-xl md:text-3xl">{data.home.name}</p><p className="mt-2 text-xs text-muted">Domicile</p></div>
                <div><p className="font-mono text-xs text-carmine-light">{minute >= 90 ? "TERMINÉ" : `${minute}'`}</p><p className="mt-2 font-display text-5xl font-bold md:text-7xl">{homeGoals} - {awayGoals}</p></div>
                <div><p className="font-display text-xl md:text-3xl">{data.away.name}</p><p className="mt-2 text-xs text-muted">Extérieur</p></div>
              </div>
              <div className="relative z-10 mt-8 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full bg-carmine transition-all" style={{ width: `${minute / 90 * 100}%` }} /></div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 p-4">
              <button onClick={() => setPlaying((current) => !current)} disabled={minute >= 90} className="rounded-xl bg-carmine px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{playing ? "Pause" : "Lecture"}</button>
              <button onClick={restart} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm">Recommencer</button>
              <button onClick={() => { setMinute(90); setPlaying(false); }} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm">Aller au résultat</button>
            </div>
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <section className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Statistiques en direct</p>
              <div className="mt-4 space-y-4">
                <StatLine label="Possession" home={`${homePossession}%`} away={`${100 - homePossession}%`} homeValue={homePossession} awayValue={100 - homePossession} />
                <StatLine label="Tirs" home={String(homeShots)} away={String(awayShots)} homeValue={homeShots} awayValue={awayShots} />
                <StatLine label="xG" home={homeXg.toFixed(2)} away={awayXg.toFixed(2)} homeValue={homeXg} awayValue={awayXg} />
                <StatLine label="Corners" home={String(visibleEvents.filter((e) => e.type === "corner" && e.team === "home").length)} away={String(visibleEvents.filter((e) => e.type === "corner" && e.team === "away").length)} homeValue={1} awayValue={1} />
                <StatLine label="Cartons" home={String(visibleEvents.filter((e) => ["yellow", "red"].includes(e.type) && e.team === "home").length)} away={String(visibleEvents.filter((e) => ["yellow", "red"].includes(e.type) && e.team === "away").length)} homeValue={1} awayValue={1} />
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5">
              <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Commentaires</p><h2 className="mt-1 font-display text-2xl">Fil du match</h2></div><span className="font-mono text-xs text-muted">{visibleEvents.length} événement(s)</span></div>
              <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {[...visibleEvents].reverse().map((event, index) => <div key={`${event.minute}-${event.type}-${index}`} className={`rounded-xl border p-3 ${event.type === "goal" ? "border-carmine/40 bg-carmine/10" : "border-white/8 bg-white/[0.03]"}`}>
                  <div className="flex items-start gap-3"><span className="text-lg">{ICONS[event.type] ?? "•"}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{event.playerName || event.type.replaceAll("_", " ")}</p><span className="font-mono text-xs text-muted">{event.minute}&apos;</span></div><p className="mt-1 text-xs leading-relaxed text-muted">{event.commentary || "Action de jeu."}</p></div></div>
                </div>)}
                {!visibleEvents.length && <p className="rounded-xl bg-white/5 p-5 text-center text-sm text-muted">Appuie sur Lecture pour lancer le replay.</p>}
              </div>
            </section>
          </div>
        </>}
      </main>
    </div>
  );
}

function StatLine({ label, home, away, homeValue, awayValue }: { label: string; home: string; away: string; homeValue: number; awayValue: number }) {
  const total = Math.max(1, homeValue + awayValue);
  const width = homeValue / total * 100;
  return <div><div className="flex items-center justify-between text-sm"><span className="font-mono">{home}</span><span className="text-xs text-muted">{label}</span><span className="font-mono">{away}</span></div><div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-white/10"><div className="bg-carmine" style={{ width: `${width}%` }} /><div className="bg-white/30" style={{ width: `${100 - width}%` }} /></div></div>;
}
