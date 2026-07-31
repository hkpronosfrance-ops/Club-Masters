"use client";

import { useEffect, useState } from "react";
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

export default function TacticsPage() {
  const supabase = createClient();
  const [club, setClub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
      if (!profile?.club_id) return;
      const { data: clubData } = await supabase.from("clubs").select("*").eq("id", profile.club_id).single();
      setClub(clubData);
      setLoading(false);
    })();
  }, []);

  async function updateClub(fields: Partial<any>) {
    setClub((c: any) => ({ ...c, ...fields }));
    await supabase.from("clubs").update(fields).eq("id", club.id);
  }

  async function playMatch() {
    setSimulating(true);
    setError(null);
    setMatchResult(null);
    try {
      const res = await fetch("/api/match/simulate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de simulation");
      setMatchResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSimulating(false);
    }
  }

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Chargement…</div>;

  return (
    <div className="min-h-screen pitch-bg pb-24 md:pb-8">
      <Nav />
      <main className="max-w-3xl mx-auto px-5 py-8">
        <h1 className="font-display text-2xl font-semibold mb-6">Préparation du match</h1>

        <div className="bg-pitch-900 border border-pitch-700 rounded-lg p-5 mb-5">
          <label className="text-xs uppercase tracking-wide text-muted">Formation</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {FORMATIONS.map((f) => (
              <button
                key={f}
                onClick={() => updateClub({ formation: f })}
                className={`px-3 py-1.5 rounded text-sm font-mono transition ${
                  club.formation === f ? "bg-carmine text-white" : "bg-pitch-800 text-muted hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <label className="text-xs uppercase tracking-wide text-muted mt-5 block">Style de jeu</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => updateClub({ tactic_style: s.value })}
                className={`px-3 py-1.5 rounded text-sm transition ${
                  club.tactic_style === s.value ? "bg-carmine text-white" : "bg-pitch-800 text-muted hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <label className="text-xs uppercase tracking-wide text-muted mt-5 block">
            Mentalité : {club.mentality < 40 ? "Prudente" : club.mentality > 60 ? "Audacieuse" : "Neutre"}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={club.mentality}
            onChange={(e) => updateClub({ mentality: Number(e.target.value) })}
            className="w-full mt-2 accent-carmine"
          />
        </div>

        <button
          onClick={playMatch}
          disabled={simulating}
          className="w-full bg-carmine hover:bg-carmine-light transition text-white font-display text-lg py-3.5 rounded-lg disabled:opacity-50"
        >
          {simulating ? "Coup d'envoi…" : "▶ Lancer le match"}
        </button>

        {error && <p className="text-carmine-light text-sm mt-3">{error}</p>}

        {matchResult && (
          <div className="ticket-card bg-pitch-900 border border-pitch-700 mt-6 p-6">
            <p className="text-center text-xs uppercase tracking-widest text-muted font-mono mb-2">Résultat final</p>
            <div className="flex items-center justify-center gap-6">
              <span className={`font-display text-lg ${matchResult.homeIsMe ? "text-carmine-light" : "text-zinc-300"}`}>
                {matchResult.home.name}
              </span>
              <span className="font-display text-4xl font-bold">
                {matchResult.result.homeScore} - {matchResult.result.awayScore}
              </span>
              <span className={`font-display text-lg ${!matchResult.homeIsMe ? "text-carmine-light" : "text-zinc-300"}`}>
                {matchResult.away.name}
              </span>
            </div>

            <p className="text-center text-xs text-muted mt-3 font-mono">
              +{matchResult.ticketRevenue.toLocaleString("fr-FR")} € de billetterie
            </p>

            <div className="mt-5 space-y-1.5">
              {matchResult.result.events.map((ev: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-muted w-8 text-right">{ev.minute}&apos;</span>
                  <span>⚽</span>
                  <span className={ev.team === "home" ? "text-carmine-light" : "text-zinc-300"}>{ev.playerName}</span>
                </div>
              ))}
              {!matchResult.result.events.length && (
                <p className="text-center text-sm text-muted">Match nul et vierge, 0-0.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
