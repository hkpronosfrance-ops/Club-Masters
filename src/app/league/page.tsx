"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";

type LeagueData = {
  season: { id: string; name: string; status: string; current_round: number; total_rounds: number };
  clubId: string;
  standings: any[];
  fixtures: any[];
};

export default function LeaguePage() {
  const [data, setData] = useState<LeagueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const response = await fetch("/api/league", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Impossible de charger le championnat.");
    setData(payload);
  }

  useEffect(() => {
    load().catch((caught) => setError(caught.message)).finally(() => setLoading(false));
  }, []);

  const currentRound = data?.season.current_round ?? 1;
  const displayedRound = Math.min(currentRound, data?.season.total_rounds ?? currentRound);
  const roundFixtures = useMemo(() => data?.fixtures.filter((fixture) => fixture.round === displayedRound) ?? [], [data, displayedRound]);
  const myNextFixture = data?.fixtures.find((fixture) => !fixture.played && (fixture.home_club_id === data.clubId || fixture.away_club_id === data.clubId));

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Création du championnat…</div>;

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        <section className="rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-carmine-light">Compétition officielle</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="font-display text-3xl font-semibold md:text-5xl">{data?.season.name ?? "Championnat"}</h1><p className="mt-2 text-sm text-muted">Affronte chaque club à domicile et à l’extérieur.</p></div>
            <div className="grid grid-cols-2 gap-2 text-center"><Metric label="Journée" value={`${Math.min(currentRound, data?.season.total_rounds ?? 0)}/${data?.season.total_rounds ?? 0}`} /><Metric label="Statut" value={data?.season.status === "finished" ? "Terminée" : "En cours"} /></div>
          </div>
        </section>

        {error && <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/85">
            <div className="border-b border-white/10 p-5"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Hiérarchie</p><h2 className="mt-1 font-display text-2xl">Classement</h2></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-white/[0.03] text-[10px] uppercase tracking-wide text-muted"><tr><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">Club</th><th>J</th><th>G</th><th>N</th><th>P</th><th>DB</th><th className="px-4">Pts</th></tr></thead><tbody>
              {data?.standings.map((row, index) => { const mine = row.club_id === data.clubId; const difference = row.goals_for - row.goals_against; return <tr key={row.club_id} className={`border-t border-white/5 ${mine ? "bg-carmine/10" : ""}`}><td className="px-4 py-3 font-mono text-muted">{index + 1}</td><td className="px-4 py-3 font-semibold"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.club?.primary_color }} />{row.club?.name}{mine && <span className="ml-2 text-[9px] uppercase text-carmine-light">Ton club</span>}</td><td className="text-center">{row.played}</td><td className="text-center">{row.wins}</td><td className="text-center">{row.draws}</td><td className="text-center">{row.losses}</td><td className="text-center font-mono">{difference > 0 ? "+" : ""}{difference}</td><td className="px-4 text-center font-display text-lg">{row.points}</td></tr>; })}
            </tbody></table></div>
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Prochain rendez-vous</p><h2 className="mt-1 font-display text-2xl">{myNextFixture ? `Journée ${myNextFixture.round}` : "Saison terminée"}</h2>
              {myNextFixture ? <><div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-white/5 p-5 text-center"><span className={myNextFixture.home_club_id === data?.clubId ? "text-carmine-light" : ""}>{myNextFixture.home?.name}</span><span className="font-mono text-xs text-muted">VS</span><span className={myNextFixture.away_club_id === data?.clubId ? "text-carmine-light" : ""}>{myNextFixture.away?.name}</span></div><p className="mt-3 text-center text-xs uppercase tracking-[0.15em] text-muted">{myNextFixture.home_club_id === data?.clubId ? "Match à domicile" : "Match à l’extérieur"}</p></> : <p className="mt-4 text-sm text-muted">Le classement final est désormais figé.</p>}
              {data?.season.status !== "finished" && myNextFixture ? <Link href="/tactics" className="mt-4 block w-full rounded-xl bg-carmine px-4 py-3 text-center font-display text-lg text-white">Préparer et jouer le match</Link> : <button disabled className="mt-4 w-full rounded-xl bg-carmine px-4 py-3 font-display text-lg text-white opacity-40">Saison terminée</button>}
              <p className="mt-3 text-xs leading-5 text-muted">Tu choisis désormais tes titulaires et ta tactique. Après ton match, les autres rencontres de la journée sont simulées et le classement est actualisé.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5"><p className="text-[10px] uppercase tracking-[0.18em] text-muted">Programme</p><h2 className="mt-1 font-display text-2xl">Journée {displayedRound}</h2><div className="mt-4 space-y-2">{roundFixtures.map((fixture) => <div key={fixture.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-white/5 px-3 py-3 text-sm"><span className="truncate text-right">{fixture.home?.short_name ?? fixture.home?.name}</span><span className="min-w-14 text-center font-mono">{fixture.played ? `${fixture.home_score} - ${fixture.away_score}` : "à jouer"}</span><span className="truncate">{fixture.away?.short_name ?? fixture.away?.name}</span></div>)}</div></div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"><p className="text-[8px] uppercase tracking-wide text-muted">{label}</p><p className="mt-1 font-mono text-sm">{value}</p></div>;
}
