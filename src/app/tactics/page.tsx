"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";

const FORMATIONS = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "5-3-2"];
const STYLES = [
  { value: "balanced", label: "Équilibré", description: "Bloc compact et transitions maîtrisées" },
  { value: "offensif", label: "Offensif", description: "Pressing haut et beaucoup de projections" },
  { value: "defensif", label: "Défensif", description: "Priorité à la solidité et au contrôle" },
  { value: "possession", label: "Possession", description: "Circulation patiente et maîtrise du ballon" },
  { value: "contre", label: "Contre-attaque", description: "Bloc bas et sorties rapides" },
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
      if (!profile?.club_id) return;
      const { data: clubData } = await supabase.from("clubs").select("*").eq("id", profile.club_id).single();
      setClub(clubData);
      setLoading(false);
    })();
  }, []);

  const mentalityLabel = useMemo(() => {
    if (!club) return "Neutre";
    if (club.mentality < 25) return "Très prudente";
    if (club.mentality < 45) return "Prudente";
    if (club.mentality > 75) return "Très audacieuse";
    if (club.mentality > 55) return "Audacieuse";
    return "Neutre";
  }, [club]);

  async function updateClub(fields: Record<string, unknown>) {
    setClub((current: any) => ({ ...current, ...fields }));
    const { error: updateError } = await supabase.from("clubs").update(fields).eq("id", club.id);
    if (updateError) setError(updateError.message);
  }

  async function playMatch() {
    setSimulating(true);
    setError(null);
    setMatchResult(null);
    try {
      const response = await fetch("/api/match/simulate", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur de simulation");
      setMatchResult(data);
    } catch (caught: any) {
      setError(caught.message ?? "La rencontre n’a pas pu être lancée.");
    } finally {
      setSimulating(false);
    }
  }

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Préparation du vestiaire…</div>;

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <section className="mb-5 rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-carmine-light">Vestiaire · Jour de match</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-semibold md:text-5xl">Préparation tactique</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Définis ton plan de jeu, ajuste la mentalité de l’équipe puis lance la rencontre.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Plan actif</p>
              <p className="mt-1 font-mono text-sm text-white">{club.formation} · {mentalityLabel}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Organisation</p>
            <h2 className="mt-1 font-display text-2xl">Formation</h2>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FORMATIONS.map((formation) => (
                <button key={formation} onClick={() => updateClub({ formation })} className={`rounded-xl border px-3 py-3 font-mono text-sm transition ${club.formation === formation ? "border-carmine bg-carmine text-white" : "border-white/10 bg-white/5 text-muted hover:border-carmine/30 hover:text-white"}`}>{formation}</button>
              ))}
            </div>

            <p className="mt-7 text-[10px] uppercase tracking-[0.18em] text-muted">Identité de jeu</p>
            <h2 className="mt-1 font-display text-2xl">Style</h2>
            <div className="mt-4 space-y-2">
              {STYLES.map((style) => (
                <button key={style.value} onClick={() => updateClub({ tactic_style: style.value })} className={`w-full rounded-xl border p-4 text-left transition ${club.tactic_style === style.value ? "border-carmine/50 bg-carmine/10" : "border-white/10 bg-white/5 hover:border-carmine/30"}`}>
                  <div className="flex items-center justify-between gap-3"><span className="font-semibold text-white">{style.label}</span>{club.tactic_style === style.value && <span className="rounded-full bg-carmine px-2 py-1 text-[9px] uppercase tracking-wide text-white">Actif</span>}</div>
                  <p className="mt-1 text-xs text-muted">{style.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5">
              <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Prise de risque</p><h2 className="mt-1 font-display text-2xl">Mentalité</h2></div><span className="rounded-full bg-white/5 px-3 py-1 font-mono text-xs text-white">{mentalityLabel}</span></div>
              <input type="range" min={0} max={100} value={club.mentality} onChange={(event) => updateClub({ mentality: Number(event.target.value) })} className="mt-6 w-full accent-carmine" />
              <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wide text-muted"><span>Prudente</span><span>Neutre</span><span>Audacieuse</span></div>
              <div className="mt-5 rounded-xl bg-white/5 p-4 text-sm text-muted">Une mentalité offensive augmente ton potentiel de buts, mais expose davantage ta défense. Adapte-la au niveau de ton effectif.</div>
            </div>

            <button onClick={playMatch} disabled={simulating} className="w-full rounded-2xl bg-carmine px-5 py-4 font-display text-xl text-white transition hover:bg-carmine-light disabled:opacity-50">{simulating ? "Le match est en cours…" : "Lancer la rencontre"}</button>
            {error && <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
          </section>
        </div>

        {matchResult && (
          <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-pitch-900/90">
            <div className="bg-black/15 px-5 py-4 text-center"><p className="text-[10px] uppercase tracking-[0.2em] text-muted">Score final</p><div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><span className={`font-display text-lg ${matchResult.homeIsMe ? "text-carmine-light" : "text-white"}`}>{matchResult.home.name}</span><span className="font-display text-4xl font-bold md:text-6xl">{matchResult.result.homeScore} - {matchResult.result.awayScore}</span><span className={`font-display text-lg ${!matchResult.homeIsMe ? "text-carmine-light" : "text-white"}`}>{matchResult.away.name}</span></div><p className="mt-3 font-mono text-xs text-gold">+{matchResult.ticketRevenue.toLocaleString("fr-FR")} € de billetterie</p></div>
            <div className="p-5"><h3 className="font-display text-xl">Temps forts</h3><div className="mt-3 space-y-2">{matchResult.result.events.map((event: any, index: number) => <div key={`${event.minute}-${index}`} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3 text-sm"><span className="w-10 font-mono text-muted">{event.minute}&apos;</span><span>⚽</span><span className={event.team === "home" ? "text-carmine-light" : "text-white"}>{event.playerName}</span></div>)}{!matchResult.result.events.length && <p className="rounded-xl bg-white/5 p-4 text-center text-sm text-muted">Aucun but dans cette rencontre.</p>}</div></div>
          </section>
        )}
      </main>
    </div>
  );
}
