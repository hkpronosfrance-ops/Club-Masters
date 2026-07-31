import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import Crest from "@/components/Crest";

function formatMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)} M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} k€`;
  return `${n} €`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) redirect("/");

  const [{ data: club }, { data: players }, { data: recentMatches }] = await Promise.all([
    supabase.from("clubs").select("*").eq("id", profile.club_id).single(),
    supabase.from("players").select("*").eq("club_id", profile.club_id),
    supabase.from("matches").select("*").or(`home_club_id.eq.${profile.club_id},away_club_id.eq.${profile.club_id}`).order("played_at", { ascending: false }).limit(5),
  ]);

  const squad = players ?? [];
  const avgOverall = squad.length ? Math.round(squad.reduce((sum, player) => sum + player.overall, 0) / squad.length) : 0;
  const avgAge = squad.length ? (squad.reduce((sum, player) => sum + player.age, 0) / squad.length).toFixed(1) : "0";
  const avgFreshness = squad.length ? Math.round(squad.reduce((sum, player) => sum + (100 - player.fatigue), 0) / squad.length) : 0;
  const totalValue = squad.reduce((sum, player) => sum + Number(player.value ?? 0), 0);
  const totalMatches = (club?.wins ?? 0) + (club?.draws ?? 0) + (club?.losses ?? 0);
  const points = (club?.wins ?? 0) * 3 + (club?.draws ?? 0);
  const winRate = totalMatches ? Math.round(((club?.wins ?? 0) / totalMatches) * 100) : 0;

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <section className="relative mb-5 overflow-hidden rounded-3xl border border-white/10 bg-pitch-900/90 p-5 shadow-2xl shadow-black/20 md:p-8">
          <div className="absolute inset-y-0 right-0 w-64 bg-[radial-gradient(circle_at_center,rgba(200,30,58,0.24),transparent_70%)]" />
          <div className="relative flex items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-4">
              <Crest shape={club?.crest_shape ?? "shield"} primaryColor={club?.primary_color ?? "#C81E3A"} secondaryColor={club?.secondary_color ?? "#0E1015"} icon={club?.crest_icon ?? "ball"} size={72} />
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-carmine-light">Centre de commandement</p>
                <h1 className="mt-1 truncate font-display text-3xl font-semibold md:text-5xl">{club?.name}</h1>
                <p className="mt-1 text-sm text-muted">Réputation {club?.reputation}/100 · Saison en cours</p>
              </div>
            </div>
            <div className="hidden rounded-2xl border border-gold/20 bg-gold/5 px-5 py-4 text-right sm:block">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Trésorerie</p>
              <p className="mt-1 font-mono text-2xl text-gold">{formatMoney(club?.balance ?? 0)}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:hidden">
            <MiniStat label="Trésorerie" value={formatMoney(club?.balance ?? 0)} accent="text-gold" />
            <MiniStat label="Valeur effectif" value={formatMoney(totalValue)} accent="text-white" />
          </div>
        </section>

        <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat label="Note moyenne" value={String(avgOverall)} accent="text-white" />
          <MiniStat label="Âge moyen" value={avgAge} accent="text-white" />
          <MiniStat label="Fraîcheur" value={`${avgFreshness}%`} accent={avgFreshness >= 70 ? "text-emerald-300" : "text-amber-300"} />
          <MiniStat label="Taux de victoire" value={`${winRate}%`} accent="text-carmine-light" />
        </section>

        <section className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Dynamique sportive</p>
                <h2 className="mt-1 font-display text-2xl">Bilan du club</h2>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 font-mono text-xs text-muted">{points} pts</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <ResultStat label="Victoires" value={club?.wins ?? 0} className="text-emerald-300" />
              <ResultStat label="Nuls" value={club?.draws ?? 0} className="text-amber-300" />
              <ResultStat label="Défaites" value={club?.losses ?? 0} className="text-rose-300" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoLine label="Formation" value={club?.formation ?? "4-3-3"} />
              <InfoLine label="Style" value={club?.tactic_style ?? "balanced"} />
              <InfoLine label="Joueurs" value={`${squad.length} sous contrat`} />
              <InfoLine label="Valeur totale" value={formatMoney(totalValue)} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Derniers matchs</p>
            <h2 className="mt-1 font-display text-2xl">Forme récente</h2>
            <div className="mt-4 space-y-2">
              {!recentMatches?.length && <p className="rounded-xl bg-white/5 p-4 text-sm text-muted">Aucun match joué pour le moment.</p>}
              {recentMatches?.map((match) => {
                const isHome = match.home_club_id === profile.club_id;
                const myScore = isHome ? match.home_score : match.away_score;
                const oppScore = isHome ? match.away_score : match.home_score;
                const result = myScore > oppScore ? "V" : myScore === oppScore ? "N" : "D";
                const color = result === "V" ? "bg-emerald-500/15 text-emerald-300" : result === "N" ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300";
                return <div key={match.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/10 px-3 py-3 text-sm"><span className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono font-bold ${color}`}>{result}</span><span className="text-muted">{isHome ? "Domicile" : "Extérieur"}</span><span className="font-display text-xl">{myScore} - {oppScore}</span></div>;
              })}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Action href="/squad" title="Gérer l’effectif" subtitle="Analyse tes joueurs" />
          <Action href="/tactics" title="Préparer le match" subtitle="Tactique et simulation" />
          <Action href="/transfermarket" title="Explorer le mercato" subtitle="Renforce ton équipe" />
          <Action href="/tactics" title="Jouer maintenant" subtitle="Lance une rencontre" primary />
        </section>
      </main>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: string }) { return <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p><p className={`mt-2 font-display text-2xl ${accent}`}>{value}</p></div>; }
function ResultStat({ label, value, className }: { label: string; value: number; className: string }) { return <div className="rounded-xl bg-white/5 p-4 text-center"><p className={`font-display text-3xl ${className}`}>{value}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-muted">{label}</p></div>; }
function InfoLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-3 text-sm"><span className="text-muted">{label}</span><span className="font-medium capitalize text-white">{value}</span></div>; }
function Action({ href, title, subtitle, primary = false }: { href: string; title: string; subtitle: string; primary?: boolean }) { return <Link href={href} className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 ${primary ? "border-carmine/30 bg-carmine text-white" : "border-white/10 bg-pitch-900/80 hover:border-carmine/30"}`}><p className="font-semibold">{title}</p><p className={`mt-1 text-xs ${primary ? "text-white/70" : "text-muted"}`}>{subtitle}</p></Link>; }
