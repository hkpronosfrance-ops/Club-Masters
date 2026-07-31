"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";

export default function RecoveryPage() {
  const supabase = createClient();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
    if (!profile?.club_id) return;
    const { data } = await supabase.from("players").select("id,first_name,last_name,position,overall,fatigue,morale,injured_until,injury_type").eq("club_id", profile.club_id).order("fatigue", { ascending: false });
    setPlayers(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const injured = useMemo(() => players.filter((player) => player.injured_until && new Date(player.injured_until).getTime() > Date.now()), [players]);
  const averageFreshness = players.length ? Math.round(players.reduce((sum, player) => sum + (100 - player.fatigue), 0) / players.length) : 0;

  async function recover() {
    setWorking(true);
    setMessage(null);
    const response = await fetch("/api/squad/recover", { method: "POST" });
    const data = await response.json();
    if (!response.ok) setMessage(data.error ?? "Repos impossible.");
    else {
      setMessage(`${data.recovered} joueurs ont suivi une séance de récupération.`);
      await load();
    }
    setWorking(false);
  }

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Ouverture du centre médical…</div>;

  return <div className="min-h-screen pitch-bg pb-28 md:pb-10"><Nav /><main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
    <section className="mb-5 rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-7">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-carmine-light">Pôle performance</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-3xl font-semibold md:text-5xl">Récupération & infirmerie</h1><p className="mt-2 text-sm text-muted">Préserve ton effectif et surveille les indisponibilités.</p></div><div className="grid grid-cols-2 gap-2"><Metric label="Fraîcheur moy." value={`${averageFreshness}%`} /><Metric label="Blessés" value={String(injured.length)} /></div></div>
    </section>

    {message && <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">{message}</div>}
    <button onClick={recover} disabled={working} className="mb-5 w-full rounded-2xl bg-carmine px-5 py-4 font-display text-xl text-white disabled:opacity-40">{working ? "Séance en cours…" : "Lancer un repos collectif"}</button>

    <div className="grid gap-3 lg:grid-cols-2">{players.map((player) => {
      const isInjured = player.injured_until && new Date(player.injured_until).getTime() > Date.now();
      const days = isInjured ? Math.max(1, Math.ceil((new Date(player.injured_until).getTime() - Date.now()) / 86_400_000)) : 0;
      return <article key={player.id} className={`rounded-2xl border p-4 ${isInjured ? "border-rose-400/25 bg-rose-500/10" : "border-white/10 bg-pitch-900/85"}`}><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 font-display text-xl">{player.overall}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{player.first_name} {player.last_name}</p><p className="mt-1 text-xs text-muted">{player.position} · Moral {player.morale}</p></div><div className="text-right"><p className="font-mono text-sm">{100 - player.fatigue}%</p><p className="text-[9px] uppercase tracking-wide text-muted">Fraîcheur</p></div></div>{isInjured && <div className="mt-3 rounded-xl bg-black/15 px-3 py-2 text-sm text-rose-200">{player.injury_type ?? "Blessure"} · environ {days} jour(s)</div>}</article>;
    })}</div>
  </main></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center"><p className="text-[8px] uppercase tracking-wide text-muted">{label}</p><p className="mt-1 font-mono text-lg">{value}</p></div>; }
