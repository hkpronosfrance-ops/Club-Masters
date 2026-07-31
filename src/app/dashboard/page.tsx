import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import Crest from "@/components/Crest";

function formatMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(Math.abs(value) >= 10_000_000 ? 1 : 2)} M€`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)} k€`;
  return `${value} €`;
}

function daysUntil(date?: string | null) {
  if (!date) return null;
  return Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000));
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) redirect("/");
  const clubId = profile.club_id;

  const [
    { data: club },
    { data: players },
    { data: recentMatches },
    { data: activeSeason },
    { data: news },
    { data: negotiations },
  ] = await Promise.all([
    supabase.from("clubs").select("*").eq("id", clubId).single(),
    supabase.from("players").select("*").eq("club_id", clubId),
    supabase.from("matches").select("*").or(`home_club_id.eq.${clubId},away_club_id.eq.${clubId}`).order("played_at", { ascending: false }).limit(5),
    supabase.from("seasons").select("*").eq("user_club_id", clubId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("world_news").select("id,title,body,category,importance,created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("transfer_negotiations").select("id,status,created_at").eq("buyer_club_id", clubId).in("status", ["accepted", "countered", "pending"]).order("created_at", { ascending: false }).limit(10),
  ]);

  let nextFixture: any = null;
  let opponent: any = null;
  let standing: any = null;
  let boardPosition: number | null = null;
  if (activeSeason) {
    const [{ data: fixture }, { data: table }] = await Promise.all([
      supabase.from("league_fixtures").select("*").eq("season_id", activeSeason.id).eq("played", false).or(`home_club_id.eq.${clubId},away_club_id.eq.${clubId}`).order("round", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("season_clubs").select("club_id,points,goals_for,goals_against,wins,draws,losses,played").eq("season_id", activeSeason.id).order("points", { ascending: false }).order("goals_for", { ascending: false }),
    ]);
    nextFixture = fixture;
    if (fixture) {
      const opponentId = fixture.home_club_id === clubId ? fixture.away_club_id : fixture.home_club_id;
      const { data } = await supabase.from("clubs").select("id,name,reputation,crest_shape,primary_color,secondary_color,crest_icon").eq("id", opponentId).single();
      opponent = data;
    }
    const ordered = table ?? [];
    boardPosition = ordered.findIndex((row) => row.club_id === clubId) + 1;
    standing = ordered.find((row) => row.club_id === clubId) ?? null;
  }

  const squad = players ?? [];
  const avgOverall = squad.length ? Math.round(squad.reduce((sum, player) => sum + Number(player.overall ?? 0), 0) / squad.length) : 0;
  const avgMorale = squad.length ? Math.round(squad.reduce((sum, player) => sum + Number(player.morale ?? 50), 0) / squad.length) : 0;
  const avgFreshness = squad.length ? Math.round(squad.reduce((sum, player) => sum + (100 - Number(player.fatigue ?? 0)), 0) / squad.length) : 0;
  const totalValue = squad.reduce((sum, player) => sum + Number(player.value ?? 0), 0);
  const wageBill = squad.reduce((sum, player) => sum + Number(player.wage ?? 0), 0);
  const injured = squad.filter((player) => player.injured_until && new Date(player.injured_until).getTime() > Date.now());
  const tired = squad.filter((player) => Number(player.fatigue ?? 0) >= 70);
  const unhappy = squad.filter((player) => Number(player.morale ?? 50) < 40);
  const expiring = squad.filter((player) => {
    const days = daysUntil(player.contract_until);
    return days !== null && days <= 180;
  });
  const priorities = [
    injured.length ? { label: `${injured.length} joueur(s) blessé(s)`, href: "/recovery", tone: "danger" } : null,
    tired.length ? { label: `${tired.length} joueur(s) très fatigué(s)`, href: "/training", tone: "warning" } : null,
    unhappy.length ? { label: `${unhappy.length} joueur(s) mécontent(s)`, href: "/locker-room", tone: "warning" } : null,
    expiring.length ? { label: `${expiring.length} contrat(s) à renouveler`, href: "/agents", tone: "info" } : null,
    negotiations?.length ? { label: `${negotiations.length} négociation(s) à traiter`, href: "/negotiations", tone: "info" } : null,
  ].filter(Boolean) as { label: string; href: string; tone: string }[];

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-pitch-900/90 p-5 shadow-2xl shadow-black/30 md:p-8">
          <div className="absolute inset-y-0 right-0 w-96 bg-[radial-gradient(circle_at_center,rgba(200,30,58,0.24),transparent_66%)]" />
          <div className="relative flex flex-wrap items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-4">
              <Crest shape={club?.crest_shape ?? "shield"} primaryColor={club?.primary_color ?? "#C81E3A"} secondaryColor={club?.secondary_color ?? "#0E1015"} icon={club?.crest_icon ?? "ball"} size={76} />
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-carmine-light">Foundation 0.2 · Centre de contrôle</p>
                <h1 className="mt-1 truncate font-display text-3xl font-semibold md:text-5xl">{club?.name}</h1>
                <p className="mt-2 text-sm text-muted">Réputation {club?.reputation ?? 50}/100 · {boardPosition ? `${boardPosition}e du championnat` : "Pré-saison"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <TopMetric label="Trésorerie" value={formatMoney(Number(club?.balance ?? 0))} accent="text-gold" />
              <TopMetric label="Valeur effectif" value={formatMoney(totalValue)} />
              <TopMetric label="Masse salariale" value={`${formatMoney(wageBill)}/sem.`} className="col-span-2 sm:col-span-1" />
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
          <div className="space-y-5">
            <section className="grid gap-4 md:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-3xl border border-white/10 bg-pitch-900/85 p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-[10px] uppercase tracking-[0.2em] text-muted">Prochain rendez-vous</p><h2 className="mt-1 font-display text-2xl">Journée {nextFixture?.round ?? activeSeason?.current_round ?? "—"}</h2></div>
                  <span className="rounded-full bg-carmine/10 px-3 py-1 text-xs text-carmine-light">Championnat</span>
                </div>
                {nextFixture && opponent ? <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
                  <div><Crest shape={club?.crest_shape ?? "shield"} primaryColor={club?.primary_color ?? "#C81E3A"} secondaryColor={club?.secondary_color ?? "#0E1015"} icon={club?.crest_icon ?? "ball"} size={56} /><p className="mt-2 font-semibold">{club?.name}</p></div>
                  <div><p className="font-mono text-xs text-muted">{nextFixture.home_club_id === clubId ? "DOM." : "EXT."}</p><p className="mt-2 font-display text-3xl">VS</p></div>
                  <div><Crest shape={opponent.crest_shape ?? "shield"} primaryColor={opponent.primary_color ?? "#334155"} secondaryColor={opponent.secondary_color ?? "#111827"} icon={opponent.crest_icon ?? "ball"} size={56} /><p className="mt-2 font-semibold">{opponent.name}</p></div>
                </div> : <p className="mt-6 rounded-2xl bg-white/5 p-5 text-sm text-muted">Aucune rencontre programmée. Ouvre la page Ligue pour initialiser ou poursuivre la saison.</p>}
                <div className="mt-6 grid grid-cols-3 gap-2"><SmallMetric label="Note équipe" value={String(avgOverall)} /><SmallMetric label="Fraîcheur" value={`${avgFreshness}%`} /><SmallMetric label="Moral" value={`${avgMorale}%`} /></div>
                <div className="mt-4 grid grid-cols-2 gap-2"><Action href="/tactics" title="Préparer le match" primary /><Action href="/match-live" title="Dernier replay" /></div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-pitch-900/85 p-5 md:p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Direction</p><h2 className="mt-1 font-display text-2xl">Objectif de saison</h2>
                <p className="mt-4 text-lg font-semibold">{activeSeason?.objective_label ?? "Stabiliser le projet"}</p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-carmine" style={{ width: `${Math.min(100, Math.max(8, standing?.played ? standing.points / Math.max(1, standing.played * 3) * 100 : 10))}%` }} /></div>
                <div className="mt-4 space-y-2 text-sm"><Info label="Position" value={boardPosition ? `${boardPosition}e` : "—"} /><Info label="Points" value={String(standing?.points ?? 0)} /><Info label="Différence" value={String((standing?.goals_for ?? 0) - (standing?.goals_against ?? 0))} /></div>
                <Link href="/board" className="mt-5 block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm hover:border-carmine/40">Voir les attentes de la direction</Link>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatusCard label="Blessés" value={injured.length} href="/recovery" tone={injured.length ? "danger" : "good"} />
              <StatusCard label="Fatigués" value={tired.length} href="/training" tone={tired.length ? "warning" : "good"} />
              <StatusCard label="Mécontents" value={unhappy.length} href="/locker-room" tone={unhappy.length ? "warning" : "good"} />
              <StatusCard label="Contrats < 6 mois" value={expiring.length} href="/agents" tone={expiring.length ? "danger" : "good"} />
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <Panel title="Forme récente" eyebrow="Résultats">
                <div className="space-y-2">{recentMatches?.map((match) => {
                  const isHome = match.home_club_id === clubId;
                  const myScore = isHome ? match.home_score : match.away_score;
                  const oppScore = isHome ? match.away_score : match.home_score;
                  const result = myScore > oppScore ? "V" : myScore === oppScore ? "N" : "D";
                  const tone = result === "V" ? "bg-emerald-500/15 text-emerald-300" : result === "N" ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300";
                  return <div key={match.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-3"><span className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono font-bold ${tone}`}>{result}</span><span className="text-xs text-muted">{isHome ? "Domicile" : "Extérieur"}</span><span className="font-display text-xl">{myScore} - {oppScore}</span></div>;
                })}{!recentMatches?.length && <Empty text="Aucun match joué." />}</div>
              </Panel>

              <Panel title="Actualités du monde" eyebrow="Fil d’information">
                <div className="space-y-3">{news?.map((item) => <div key={item.id} className="border-b border-white/5 pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{item.title}</p><span className="text-[9px] uppercase text-muted">{item.category}</span></div><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{item.body}</p></div>)}{!news?.length && <Empty text="Aucune actualité récente." />}</div>
                <Link href="/world" className="mt-4 block text-sm text-carmine-light">Ouvrir toutes les actualités →</Link>
              </Panel>
            </section>
          </div>

          <aside className="space-y-5">
            <Panel title="À traiter" eyebrow="Priorités du manager">
              <div className="space-y-2">{priorities.map((item) => <Link key={item.label} href={item.href} className={`block rounded-xl border px-3 py-3 text-sm ${item.tone === "danger" ? "border-rose-400/20 bg-rose-500/10 text-rose-200" : item.tone === "warning" ? "border-amber-400/20 bg-amber-500/10 text-amber-200" : "border-sky-400/20 bg-sky-500/10 text-sky-200"}`}>{item.label}<span className="float-right">→</span></Link>)}{!priorities.length && <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">Tout est sous contrôle.</div>}</div>
            </Panel>

            <Panel title="Accès rapides" eyebrow="Gestion du club">
              <div className="grid grid-cols-2 gap-2"><Quick href="/squad" icon="👥" label="Effectif" /><Quick href="/training" icon="🏋️" label="Entraînement" /><Quick href="/data-center" icon="📊" label="Données" /><Quick href="/transfermarket" icon="💰" label="Mercato" /><Quick href="/academy" icon="🌟" label="Académie" /><Quick href="/career" icon="🧑‍💼" label="Carrière" /></div>
            </Panel>

            <Panel title="Indicateurs club" eyebrow="Vue d’ensemble">
              <div className="space-y-3"><Progress label="Qualité sportive" value={avgOverall} /><Progress label="Condition physique" value={avgFreshness} /><Progress label="Moral collectif" value={avgMorale} /><Progress label="Réputation" value={Number(club?.reputation ?? 50)} /></div>
            </Panel>
          </aside>
        </div>
      </main>
    </div>
  );
}

function TopMetric({ label, value, accent = "text-white", className = "" }: { label: string; value: string; accent?: string; className?: string }) { return <div className={`rounded-2xl border border-white/10 bg-black/15 px-4 py-3 ${className}`}><p className="text-[9px] uppercase tracking-[0.16em] text-muted">{label}</p><p className={`mt-1 font-mono text-sm md:text-base ${accent}`}>{value}</p></div>; }
function SmallMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/5 p-3 text-center"><p className="font-display text-xl">{value}</p><p className="mt-1 text-[9px] uppercase tracking-wide text-muted">{label}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex justify-between rounded-lg bg-white/[0.04] px-3 py-2"><span className="text-muted">{label}</span><span>{value}</span></div>; }
function Action({ href, title, primary = false }: { href: string; title: string; primary?: boolean }) { return <Link href={href} className={`rounded-xl px-3 py-3 text-center text-sm font-semibold ${primary ? "bg-carmine text-white" : "border border-white/10 bg-white/5"}`}>{title}</Link>; }
function StatusCard({ label, value, href, tone }: { label: string; value: number; href: string; tone: "danger" | "warning" | "good" }) { const style = tone === "danger" ? "text-rose-300" : tone === "warning" ? "text-amber-300" : "text-emerald-300"; return <Link href={href} className="rounded-2xl border border-white/10 bg-pitch-900/80 p-4 transition hover:-translate-y-0.5 hover:border-white/20"><p className={`font-display text-3xl ${style}`}>{value}</p><p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p></Link>; }
function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-white/10 bg-pitch-900/85 p-5"><p className="text-[10px] uppercase tracking-[0.2em] text-muted">{eyebrow}</p><h2 className="mt-1 mb-4 font-display text-2xl">{title}</h2>{children}</section>; }
function Empty({ text }: { text: string }) { return <p className="rounded-xl bg-white/5 p-4 text-sm text-muted">{text}</p>; }
function Quick({ href, icon, label }: { href: string; icon: string; label: string }) { return <Link href={href} className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center hover:border-carmine/30"><span className="text-xl">{icon}</span><p className="mt-1 text-xs">{label}</p></Link>; }
function Progress({ label, value }: { label: string; value: number }) { return <div><div className="flex justify-between text-xs"><span className="text-muted">{label}</span><span className="font-mono">{Math.round(value)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-carmine" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>; }
