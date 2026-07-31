"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

const STYLES: Record<string, string> = {
  offensive: "Offensif",
  defensive: "Défensif",
  youth: "Formation des jeunes",
  discipline: "Discipline",
  tactician: "Tacticien",
};

function money(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0);
}

export default function CareerPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ displayName: "", age: 35, nationality: "France", managementStyle: "tactician" });

  async function load() {
    const response = await fetch("/api/career", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Chargement impossible.");
    setData(payload);
    setForm({ displayName: payload.manager.display_name, age: payload.manager.age, nationality: payload.manager.nationality, managementStyle: payload.manager.management_style });
  }

  useEffect(() => { load().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);

  async function request(method: string, body: any) {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/career", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Action impossible.");
      setData(payload);
      setForm({ displayName: payload.manager.display_name, age: payload.manager.age, nationality: payload.manager.nationality, managementStyle: payload.manager.management_style });
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Chargement de la carrière…</div>;
  const manager = data?.manager;

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-10">
        <section className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-pitch-900/90 p-5 md:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-carmine-light">Mode carrière</p>
          <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div><h1 className="font-display text-4xl md:text-6xl">{manager?.display_name}</h1><p className="mt-2 text-muted">{manager?.rank} · {data?.currentClub?.name ?? "Sans club"}</p></div>
            <button disabled={busy} onClick={() => request("POST", { action: "generate_offers" })} className="rounded-xl bg-carmine px-5 py-3 text-sm font-semibold disabled:opacity-50">Rechercher des offres</button>
          </div>
        </section>

        {error && <div className="mb-5 rounded-xl border border-carmine/25 bg-carmine/10 p-4 text-sm text-carmine-light">{error}</div>}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Réputation" value={`${manager?.reputation}/100`} />
          <Metric label="Salaire annuel" value={money(manager?.salary)} />
          <Metric label="Contrat jusqu’au" value={manager?.contract_until ?? "—"} />
          <Metric label="Score carrière" value={`${manager?.career_score ?? 0}`} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-white/8 bg-pitch-900/80 p-5">
            <h2 className="font-display text-2xl">Identité du manager</h2>
            <div className="mt-4 grid gap-4">
              <label className="text-xs text-muted">Nom<input className="field-input mt-2 w-full" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted">Âge<input type="number" className="field-input mt-2 w-full" value={form.age} onChange={(e) => setForm({ ...form, age: Number(e.target.value) })} /></label>
                <label className="text-xs text-muted">Nationalité<input className="field-input mt-2 w-full" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></label>
              </div>
              <label className="text-xs text-muted">Style<select className="field-input mt-2 w-full" value={form.managementStyle} onChange={(e) => setForm({ ...form, managementStyle: e.target.value })}>{Object.entries(STYLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <button disabled={busy} onClick={() => request("PATCH", form)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10 disabled:opacity-50">Enregistrer le profil</button>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center"><Stat label="Matchs" value={manager?.matches} /><Stat label="Victoires" value={manager?.wins} /><Stat label="Trophées" value={manager?.trophies} /></div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-2xl">Offres de clubs</h2>
            <div className="space-y-3">
              {(data?.offers ?? []).filter((offer: any) => offer.status === "pending").length === 0 && <div className="rounded-2xl border border-white/8 bg-pitch-900/70 p-6 text-sm text-muted">Aucune offre en attente. Ta réputation détermine les clubs intéressés.</div>}
              {(data?.offers ?? []).filter((offer: any) => offer.status === "pending").map((offer: any) => <article key={offer.id} className="rounded-2xl border border-white/8 bg-pitch-900/80 p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{offer.clubs?.name}</h3><p className="mt-1 text-xs text-muted">Réputation du club : {offer.clubs?.reputation ?? 0}</p></div><span className="font-mono text-sm text-emerald-300">{money(offer.salary)}/an</span></div><p className="mt-4 text-sm text-muted">Objectif : {offer.objective}</p><p className="mt-1 text-xs text-muted">Contrat de {offer.contract_years} ans</p><div className="mt-4 flex gap-2"><button disabled={busy} onClick={() => request("POST", { action: "respond_offer", offerId: offer.id, decision: "accepted" })} className="rounded-lg bg-carmine px-4 py-2 text-xs font-semibold">Accepter</button><button disabled={busy} onClick={() => request("POST", { action: "respond_offer", offerId: offer.id, decision: "rejected" })} className="rounded-lg border border-white/10 px-4 py-2 text-xs">Refuser</button></div></article>)}
            </div>
          </section>
        </div>

        <section className="mt-7 grid gap-6 lg:grid-cols-2">
          <div><h2 className="mb-3 font-display text-2xl">Historique</h2><div className="space-y-2">{(data?.history ?? []).map((item: any) => <div key={item.id} className="rounded-xl border border-white/8 bg-pitch-900/70 p-4"><div className="flex justify-between"><strong>{item.club_name}</strong><span className="text-xs text-muted">{item.started_at} — {item.ended_at ?? "Aujourd’hui"}</span></div><p className="mt-2 text-xs text-muted">{item.matches} matchs · {item.wins} victoires · {item.trophies} trophées</p></div>)}</div></div>
          <div><h2 className="mb-3 font-display text-2xl">Salle des trophées</h2><div className="space-y-2">{(data?.trophies ?? []).length === 0 && <div className="rounded-xl border border-white/8 bg-pitch-900/70 p-5 text-sm text-muted">Ton premier trophée apparaîtra ici.</div>}{(data?.trophies ?? []).map((item: any) => <div key={item.id} className="rounded-xl border border-amber-300/15 bg-pitch-900/70 p-4"><strong>🏆 {item.trophy_name}</strong><p className="mt-1 text-xs text-muted">Saison {item.season}</p></div>)}</div></div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/8 bg-pitch-900/80 p-4"><p className="text-[9px] uppercase tracking-[0.17em] text-muted">{label}</p><p className="mt-2 font-mono text-lg text-white">{value}</p></div>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-white/5 p-3"><p className="font-mono text-xl">{value ?? 0}</p><p className="text-[9px] uppercase tracking-wider text-muted">{label}</p></div>; }
