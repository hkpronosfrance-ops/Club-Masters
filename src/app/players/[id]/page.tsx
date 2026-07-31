import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

function formatMoney(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M€`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} k€`;
  return `${value} €`;
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-muted">
        <span>{label}</span>
        <span className="font-mono text-zinc-100">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-carmine" style={{ width: `${Math.max(4, value)}%` }} />
      </div>
    </div>
  );
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: player } = await supabase
    .from("players")
    .select("*, clubs!players_club_id_fkey(name, short_name)")
    .eq("id", id)
    .single();

  if (!player) notFound();

  const freshness = Math.max(0, 100 - player.fatigue);
  const contractLabel = player.contract_until
    ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(player.contract_until))
    : "Non renseigné";

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">
        <Link href="/squad" className="mb-4 inline-flex text-sm text-muted transition hover:text-white">← Retour à l’effectif</Link>

        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-pitch-900/95 p-5 shadow-2xl md:p-8">
          <div className="absolute right-0 top-0 h-56 w-56 bg-[radial-gradient(circle,rgba(200,30,58,0.22),transparent_70%)]" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-3xl border border-carmine/30 bg-carmine/10">
                <span className="font-display text-4xl font-semibold">{player.overall}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted">Note</span>
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-carmine/25 bg-carmine/10 px-3 py-1 font-mono text-[10px] font-bold text-carmine-light">{player.position}</span>
                  <span className="text-xs text-muted">{player.age} ans</span>
                </div>
                <h1 className="font-display text-3xl font-semibold md:text-5xl">{player.first_name} {player.last_name}</h1>
                <p className="mt-2 text-sm text-muted">{player.clubs?.name ?? "Sans club"}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 md:min-w-80">
              <Metric label="Potentiel" value={player.potential} />
              <Metric label="Forme" value={player.form} />
              <Metric label="Moral" value={player.morale} />
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-2xl border border-white/10 bg-pitch-900/90 p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl">Attributs</h2>
              <span className="text-xs uppercase tracking-[0.16em] text-muted">Niveau actuel</span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <StatBar label="Vitesse" value={player.pace} />
              <StatBar label="Tir" value={player.shooting} />
              <StatBar label="Passe" value={player.passing} />
              <StatBar label="Défense" value={player.defending} />
              <StatBar label="Physique" value={player.physical} />
              <StatBar label="Fraîcheur" value={freshness} />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-pitch-900/90 p-5 md:p-6">
            <h2 className="font-display text-2xl">Contrat</h2>
            <div className="mt-5 space-y-3">
              <Info label="Valeur estimée" value={formatMoney(player.value ?? 0)} accent />
              <Info label="Salaire" value={`${formatMoney(player.wage ?? 0)} / semaine`} />
              <Info label="Fin de contrat" value={contractLabel} />
              <Info label="Statut mercato" value={player.is_listed ? "Sur la liste des transferts" : "Conservé par le club"} />
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-2xl border border-white/10 bg-pitch-900/90 p-5 md:p-6">
          <h2 className="font-display text-2xl">Évaluation sportive</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Assessment label="Condition" value={freshness >= 75 ? "Prêt à jouer" : freshness >= 50 ? "À surveiller" : "Repos conseillé"} />
            <Assessment label="Dynamique" value={player.form >= 65 ? "Excellente forme" : player.form >= 50 ? "Forme correcte" : "En difficulté"} />
            <Assessment label="Progression" value={player.potential - player.overall >= 10 ? "Fort potentiel" : player.potential > player.overall ? "Marge modérée" : "Niveau stabilisé"} />
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-3 text-center"><p className="text-[9px] uppercase tracking-[0.15em] text-muted">{label}</p><p className="mt-1 font-mono text-lg text-white">{value}</p></div>;
}

function Info({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl bg-white/5 px-4 py-3"><span className="text-xs text-muted">{label}</span><span className={`text-right text-sm ${accent ? "font-mono text-gold" : "text-zinc-100"}`}>{value}</span></div>;
}

function Assessment({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-4"><p className="text-[9px] uppercase tracking-[0.15em] text-muted">{label}</p><p className="mt-2 text-sm font-medium text-white">{value}</p></div>;
}
