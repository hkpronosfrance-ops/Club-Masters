"use client";

import { useEffect, useState } from "react";

type Player = {
  id: string; first_name: string; last_name: string; age: number; position: string; overall: number;
  morale: number; form: number; squad_role: string; promised_role?: string | null;
  happiness_reason?: string | null; transfer_request: boolean;
};

type Payload = { club: { name: string }; players: Player[]; events: any[]; averageMorale: number };

const ROLE_LABELS: Record<string, string> = { star: "Star", important: "Important", rotation: "Rotation", prospect: "Espoir", surplus: "Indésirable" };

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

  useEffect(() => { load(); }, []);
  if (loading) return <main className="max-w-7xl mx-auto px-4 py-10 text-muted">Ouverture du vestiaire…</main>;
  if (!data) return <main className="max-w-7xl mx-auto px-4 py-10 text-carmine-light">{error}</main>;

  const unhappy = data.players.filter((player) => player.morale < 40 || player.transfer_request).length;
  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 pb-28 space-y-6">
      <section className="rounded-2xl border border-pitch-700 bg-pitch-900/70 p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div><p className="text-xs uppercase tracking-[0.25em] text-carmine-light">Gestion humaine</p><h1 className="font-display text-3xl md:text-5xl">Vestiaire</h1><p className="text-muted mt-2">Gère les statuts, les entretiens et l’équilibre du groupe.</p></div>
          <button disabled={busy === "meeting"} onClick={() => act({ action: "team_meeting" }, "meeting")} className="rounded-xl bg-carmine px-5 py-3 font-semibold disabled:opacity-50">Réunion d’équipe</button>
        </div>
      </section>

      {error && <div className="rounded-xl border border-carmine/50 bg-carmine/10 p-4 text-carmine-light">{error}</div>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Moral moyen" value={`${data.averageMorale}/100`} />
        <Stat label="Joueurs" value={String(data.players.length)} />
        <Stat label="Mécontents" value={String(unhappy)} />
        <Stat label="Demandes de départ" value={String(data.players.filter((p) => p.transfer_request).length)} />
      </section>

      <section className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-3">
          {data.players.map((player) => (
            <article key={player.id} className="rounded-2xl border border-pitch-700 bg-pitch-900/60 p-4">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="min-w-52"><div className="flex items-center gap-2"><span className="rounded bg-pitch-700 px-2 py-1 text-xs">{player.position}</span><strong>{player.first_name} {player.last_name}</strong><span className="text-muted text-sm">{player.age} ans · GEN {player.overall}</span></div><p className="text-sm mt-2 text-muted">{player.happiness_reason ?? "Aucune préoccupation particulière"}</p></div>
                <div className="w-full xl:w-44"><div className="flex justify-between text-xs mb-1"><span>Moral</span><span>{player.morale}</span></div><div className="h-2 rounded-full bg-pitch-800 overflow-hidden"><div className="h-full bg-carmine transition-all" style={{ width: `${player.morale}%` }} /></div></div>
                <select value={player.squad_role} onChange={(event) => act({ action: "set_role", playerId: player.id, role: event.target.value }, `role-${player.id}`)} className="rounded-lg border border-pitch-700 bg-pitch-950 px-3 py-2 text-sm">
                  {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <div className="flex flex-wrap gap-2">
                  <TalkButton label="Féliciter" disabled={!!busy} onClick={() => act({ action: "talk", talk: "praise", playerId: player.id }, `praise-${player.id}`)} />
                  <TalkButton label="Recadrer" disabled={!!busy} onClick={() => act({ action: "talk", talk: "criticize", playerId: player.id }, `criticize-${player.id}`)} />
                  <TalkButton label="Promettre" disabled={!!busy} onClick={() => act({ action: "talk", talk: "promise", playerId: player.id }, `promise-${player.id}`)} />
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="rounded-2xl border border-pitch-700 bg-pitch-900/60 p-5 h-fit">
          <h2 className="font-display text-xl mb-4">Journal du vestiaire</h2>
          <div className="space-y-4">{data.events.length ? data.events.map((event) => <div key={event.id} className="border-b border-pitch-700 pb-3 last:border-0"><div className="flex justify-between gap-2"><strong className="text-sm">{event.title}</strong><span className={`text-xs ${event.morale_delta >= 0 ? "text-emerald-400" : "text-carmine-light"}`}>{event.morale_delta > 0 ? "+" : ""}{event.morale_delta}</span></div><p className="text-xs text-muted mt-1">{event.body}</p></div>) : <p className="text-sm text-muted">Aucun événement pour le moment.</p>}</div>
        </aside>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-pitch-700 bg-pitch-900/60 p-4"><p className="text-xs text-muted uppercase tracking-wider">{label}</p><p className="font-display text-2xl mt-1">{value}</p></div>; }
function TalkButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) { return <button disabled={disabled} onClick={onClick} className="rounded-lg border border-pitch-600 px-3 py-2 text-xs hover:border-carmine disabled:opacity-40">{label}</button>; }
