import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

const LABELS: Record<string, string> = {
  match_bonus: "Prime de match",
  ticketing: "Billetterie",
  vip: "Espaces VIP",
  catering: "Restauration",
  merchandise: "Produits dérivés",
  transfer: "Transfert",
  infrastructure: "Infrastructure",
  wages: "Salaires",
  sponsor: "Sponsoring",
  other: "Autre",
};

function money(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export default async function FinancesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) redirect("/");

  const [{ data: club }, { data: rows }] = await Promise.all([
    supabase.from("clubs").select("id,name,balance").eq("id", profile.club_id).single(),
    supabase.from("club_finance_transactions").select("*").eq("club_id", profile.club_id).order("created_at", { ascending: false }).limit(100),
  ]);

  const transactions = rows ?? [];
  const income = transactions.filter((row) => Number(row.amount) > 0).reduce((sum, row) => sum + Number(row.amount), 0);
  const expenses = transactions.filter((row) => Number(row.amount) < 0).reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);
  const stadiumIncome = transactions.filter((row) => ["ticketing", "vip", "catering", "merchandise"].includes(row.category)).reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <section className="rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-carmine-light">Direction financière</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-semibold md:text-5xl">Finances du club</h1>
              <p className="mt-2 text-sm text-muted">Suivi détaillé de chaque revenu et dépense.</p>
            </div>
            <div className="rounded-2xl border border-gold/20 bg-gold/5 px-5 py-4 text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Trésorerie</p>
              <p className="mt-1 font-mono text-2xl text-gold">{money(Number(club?.balance ?? 0))}</p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Revenus récents" value={money(income)} className="text-emerald-300" />
          <Metric label="Dépenses récentes" value={money(expenses)} className="text-rose-300" />
          <Metric label="Revenus du stade" value={money(stadiumIncome)} className="text-gold" />
        </section>

        <section className="mt-5 rounded-2xl border border-white/10 bg-pitch-900/85 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Grand livre</p>
              <h2 className="mt-1 font-display text-2xl">Dernières opérations</h2>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 font-mono text-xs text-muted">{transactions.length} lignes</span>
          </div>

          <div className="mt-4 space-y-2">
            {!transactions.length && <p className="rounded-xl bg-white/5 p-4 text-sm text-muted">Aucune opération enregistrée pour le moment.</p>}
            {transactions.map((row) => {
              const amount = Number(row.amount);
              return (
                <div key={row.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-black/10 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{LABELS[row.category] ?? row.category}</p>
                    <p className="mt-1 truncate text-xs text-muted">{row.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-mono text-sm ${amount >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{amount >= 0 ? "+" : "−"}{money(Math.abs(amount))}</p>
                    <p className="mt-1 text-[10px] text-muted">{new Date(row.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className: string }) {
  return <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p><p className={`mt-2 font-display text-2xl ${className}`}>{value}</p></div>;
}
