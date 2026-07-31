"use client";

import { useMemo } from "react";

type MatchEvent = { minute: number; type: string; team: "home" | "away" };
type Point = { x: number; y: number };

const HOME: Point[] = [
  { x: 8, y: 50 }, { x: 24, y: 18 }, { x: 22, y: 38 }, { x: 22, y: 62 }, { x: 24, y: 82 },
  { x: 42, y: 25 }, { x: 40, y: 50 }, { x: 42, y: 75 }, { x: 60, y: 22 }, { x: 64, y: 50 }, { x: 60, y: 78 },
];
const AWAY = HOME.map((point) => ({ x: 100 - point.x, y: 100 - point.y }));

function eventTarget(event?: MatchEvent): Point {
  if (!event) return { x: 50, y: 50 };
  const attackingRight = event.team === "home";
  const goalX = attackingRight ? 94 : 6;
  const midfieldX = attackingRight ? 58 : 42;
  if (["goal", "save", "penalty", "chance", "chance_missed"].includes(event.type)) return { x: goalX, y: 42 + Math.random() * 16 };
  if (event.type === "corner") return { x: goalX, y: Math.random() > 0.5 ? 4 : 96 };
  if (event.type === "free_kick") return { x: attackingRight ? 78 : 22, y: 35 + Math.random() * 30 };
  if (["yellow", "red", "offside", "tactical_change"].includes(event.type)) return { x: midfieldX, y: 30 + Math.random() * 40 };
  return { x: 50, y: 50 };
}

export default function MatchPitch2D({ minute, events }: { minute: number; events: MatchEvent[] }) {
  const current = useMemo(() => [...events].reverse().find((event) => event.minute <= minute), [events, minute]);
  const ball = useMemo(() => eventTarget(current), [current?.minute, current?.type, current?.team]);
  const attackingHome = current?.team !== "away";

  const move = (point: Point, home: boolean, index: number): Point => {
    const isAttacking = home === attackingHome;
    const push = isAttacking ? 7 : -3;
    const direction = home ? 1 : -1;
    const pulse = ((minute + index * 3) % 7) - 3;
    return {
      x: Math.max(4, Math.min(96, point.x + push * direction + pulse * 0.35)),
      y: Math.max(5, Math.min(95, point.y + Math.sin((minute + index) / 4) * 2.4)),
    };
  };

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/15 bg-emerald-800 shadow-inner">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(90deg,rgba(255,255,255,.12) 0,rgba(255,255,255,.12) 8%,transparent 8%,transparent 16%)" }} />
      <div className="absolute inset-3 border border-white/60" />
      <div className="absolute left-1/2 top-3 bottom-3 border-l border-white/60" />
      <div className="absolute left-1/2 top-1/2 h-[24%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60" />
      <div className="absolute left-3 top-[28%] h-[44%] w-[15%] border border-l-0 border-white/60" />
      <div className="absolute right-3 top-[28%] h-[44%] w-[15%] border border-r-0 border-white/60" />
      <div className="absolute left-3 top-[39%] h-[22%] w-[6%] border border-l-0 border-white/60" />
      <div className="absolute right-3 top-[39%] h-[22%] w-[6%] border border-r-0 border-white/60" />

      {HOME.map((point, index) => {
        const position = move(point, true, index);
        return <PlayerDot key={`h-${index}`} position={position} label={index + 1} home />;
      })}
      {AWAY.map((point, index) => {
        const position = move(point, false, index);
        return <PlayerDot key={`a-${index}`} position={position} label={index + 1} />;
      })}

      <div className="absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/60 bg-white shadow-[0_0_10px_rgba(255,255,255,.9)] transition-all duration-700 ease-in-out" style={{ left: `${ball.x}%`, top: `${ball.y}%` }} />
      <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 font-mono text-[10px] text-white backdrop-blur">{minute}&apos; · {current?.type?.replaceAll("_", " ") ?? "construction"}</div>
    </div>
  );
}

function PlayerDot({ position, label, home = false }: { position: Point; label: number; home?: boolean }) {
  return <div className={`absolute z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[8px] font-bold shadow-lg transition-all duration-700 ease-in-out md:h-6 md:w-6 ${home ? "border-white bg-carmine text-white" : "border-zinc-900 bg-white text-zinc-900"}`} style={{ left: `${position.x}%`, top: `${position.y}%` }}>{label}</div>;
}
