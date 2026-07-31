"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

type Player = {
  id: string; first_name: string; last_name: string; age: number; position: string; overall: number;
  morale: number; form: number; fatigue: number; squad_role: string; promised_role?: string | null;
  happiness_reason?: string | null; transfer_request: boolean; coach_trust: number;
  contract_satisfaction: number; playing_time_satisfaction: number;
  appearances: number; starts: number; minutes: number; expectedPercent: number;
};
type Payload = { club: { name: string }; season?: { name?: string; status: string } | null; players: Player[]; events: any[]; averageMorale: number; cohesion: number };

const ROLE_LABELS: Record<string, string> = { star: "Joueur clé", important: "Titulaire", rotation: "Rotation", substitute: "Remplaçant", prospect: "Espoir", surplus: "Indésirable" };

export default function LockerRoomPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/locker-room", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) setError(json.error ?? "Chargement impossible."); else setData(json);
    setLoading(false);
  }
  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key); setError("");
    const response = await fetch("/api/locker-room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await response.json();
    if (!response.ok) setError(json.error ?? "Action impossible."); else setData(json);
    setBusy(null);
  }
  useEffect(() => { void load(); }, []);

  if (loading) return <div className="min-h-screen pitch-bg"><Nav /><main className="mx-auto max-w-7xl px-4 py-10 text-muted">Ouverture du vestiaire…</main></div>;
  if (!data) return <div className="min-h-screen pitch-bg"><Nav /><main className="mx-auto max-w-7xl px-4 py-10 text-carmine-light">{error}</main></div>;

  const unhappy = data.players.filter((player) => player.morale < 40 || player.transfer_request).length;
  return <div className="min-h-screen pitch-bg pb-28 md:pb-10"><Nav /><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8">
    <section className="rounded-3xl border border-white/10 bg-pitch-900/85 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs uppercase tracking-[0.25em] text-carmine-light">Gestion humaine</p><h1 className="font-display text-3xl md:text-5xl">Vestiaire</h1><p className="mt-2 text-muted">Statuts, temps de jeu, confiance et risques de conflit.</p></div><button disabled={busy === "meeting"} onClick={() => act({ action: "team_meeting" }, "meeting")} className="rounded-xl bg-carmine px-5 py-3 font-semibold disabled:opacity-50">Réunion d’équipe</button></div>
    </section>

    {error && <div className="rounded-xl border border-carmine/50 bg-carmine/10 p-4 text-carmine-light">{error}</div>}

    <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Stat label="Moral moyen" value={`${data.averageMorale}/100`} />
      <Stat label="Cohésion" value={`${data.cohesion}/100`} />
      <Stat label="Joueurs" value={String(data.players.length)} />
      <Stat label="Mécontents" value={String(unhappy)} />
      <Stat label="Demandes de départ" value={String(data.players.filter((p) => p.transfer_request).length)} />
    </section>

    <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">{data.players.map((player) => {
        const actualPercent = player.appearances ? Math.min(100, Math.round((player.starts / Math.max(1, player.appearances)) * 100)) : 0;
        return <article key={player.id} className={`rounded-2xl border bg-pitch-900/70 p-4 ${player.transfer_request ? "border-rose-400/40" : "border-white/10"}`}>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_180px_180px_auto] xl:items-center">
            <div><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-white/5 px-2 py-1 text-xs">{player.position}</span><strong>{player.first_name} {player.last_name}</strong><span className="text-sm text-muted">{player.age} ans · GEN {player.overall}</span>{player.transfer_request && <span className="rounded bg-rose-500/15 px-2 py-1 text-[10px] text-rose-300">Demande de départ</span>}</div><p className="mt-2 text-sm text-muted">{player.happiness_reason ?? "Aucune préoccupation particulière"}</p><p className="mt-2 text-[11px] text-zinc-400">{player.appearances} match(s) · {player.starts} titularisation(s) · {player.minutes} min</p></div>
            <div><Bar label="Moral" value={player.morale} /><div className="mt-2"><Bar label="Confiance coach" value={player.coach_trust} /></div></div>
            <div><p className="text-[10px] uppercase text-muted">Temps de jeu</p><p className="mt-1 text-sm">Attendu {player.expectedPercent}%</p><p className="text-sm text-muted">Titularisations {actualPercent}%</p><div className="mt-2"><Bar label="Satisfaction" value={player.playing_time_satisfaction} /></div></div>
            <div className="space-y-2"><select value={player.squad_role} onChange={(event) => act({ action: "set_role", playerId: player.id, role: event.target.value }, `role-${player.id}`)} className="w-full rounded-lg border border-white/10 bg-pitch-950 px-3 py-2 text-sm">{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><div className="flex flex-wrap gap-2"><TalkButton label="Féliciter" disabled={!!busy} onClick={() => act({ action: "talk", talk: "praise", playerId: player.id }, `praise-${player.id}`)} /><TalkButton label="Recadrer" disabled={!!busy} onClick={() => act({ action: "talk", talk: "criticize", playerId: player.id }, `criticize-${player.id}`)} /><TalkButton label="Promettre" disabled={!!busy} onClick={() => act({ action: "talk", talk: "promise", playerId: player.id }, `promise-${player.id}`)} /></div></div>
          </div>
        </article>;
      })}</div>

      <aside className="h-fit rounded-2xl border border-white/10 bg-pitch-900/70 p-5"><h2 className="mb-4 font-display text-xl">Journal du vestiaire</h2><div className="space-y-4">{data.events.length ? data.events.map((event) => <div key={event.id} className="border-b border-white/10 pb-3 last:border-0"><div className="flex justify-between gap-2"><strong className="text-sm">{event.title}</strong><span className={`text-xs ${event.morale_delta >= 0 ? "text-emerald-400" : "text-carmine-light"}`}>{event.morale_delta > 0 ? "+" : ""}{event.morale_delta}</span></div><p className="mt-1 text-xs text-muted">{event.body}</p></div>) : <p className="text-sm text-muted">Aucun événement pour le moment.</p>}</div></aside>
    </section>
  </main></div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4"><p className="text-xs uppercase tracking-wider text-muted">{label}</p><p className="mt-1 font-display text-2xl">{value}</p></div>; }
function Bar({ label, value }: { label: string; value: number }) { return <div><div className="mb-1 flex justify-between text-[10px]"><span>{label}</span><span>{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-pitch-800"><div className="h-full bg-carmine transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>; }
function TalkButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) { return <button disabled={disabled} onClick={onClick} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:border-carmine disabled:opacity-40">{label}</button>; }
