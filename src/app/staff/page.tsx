"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";

type StaffMember = { id: string; role: string; first_name: string; last_name: string; level: number; salary: number; specialty: string | null };
type Candidate = StaffMember & { signing_fee: number; nationality: string };
type Payload = { club: { name: string; balance: number } | null; staff: StaffMember[]; candidates: Candidate[] };

const LABELS: Record<string, string> = {
  sporting_director: "Directeur sportif",
  scout: "Recruteur",
  doctor: "Médecin",
  fitness_coach: "Préparateur physique",
  video_analyst: "Analyste vidéo",
  academy_manager: "Responsable académie",
};
const EFFECTS: Record<string, string> = {
  sporting_director: "Meilleures négociations et commissions réduites.",
  scout: "Rapports plus fiables et talents mieux détectés.",
  doctor: "Blessures moins longues et meilleure prévention.",
  fitness_coach: "Récupération plus rapide et fatigue mieux maîtrisée.",
  video_analyst: "Bonus de préparation face au prochain adversaire.",
  academy_manager: "Jeunes mieux générés et progression accrue.",
};
const money = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

export default function StaffPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/staff", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error ?? "Impossible de charger le staff.");
    setData(payload);
  }
  useEffect(() => { void load(); }, []);

  const staffByRole = useMemo(() => new Map((data?.staff ?? []).map((member) => [member.role, member])), [data]);

  async function hire(candidateId: string) {
    setBusy(candidateId); setMessage("");
    const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId }) });
    const payload = await response.json();
    setBusy(null);
    if (!response.ok) return setMessage(payload.error ?? "Recrutement impossible.");
    setData(payload); setMessage("Le nouveau membre du staff a signé son contrat.");
  }

  return <div className="min-h-screen pitch-bg pb-28 md:pb-10"><Nav /><main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
    <header className="mb-6"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-carmine-light">Organisation sportive</p><div className="mt-1 flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-display text-4xl">Staff technique</h1><p className="mt-2 text-sm text-muted">Construis une équipe de spécialistes qui améliore chaque département du club.</p></div><div className="rounded-2xl border border-white/10 bg-pitch-900/80 px-4 py-3"><p className="text-[10px] uppercase text-muted">Trésorerie</p><p className="mt-1 font-display text-2xl">{money(Number(data?.club?.balance ?? 0))}</p></div></div></header>
    {message && <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{message}</div>}
    {!data ? <div className="rounded-2xl border border-white/10 bg-pitch-900/80 p-6 text-muted">Chargement…</div> : <>
      <section className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Object.keys(LABELS).map((role) => { const member = staffByRole.get(role); return <div key={role} className="rounded-2xl border border-white/10 bg-pitch-900/85 p-5"><p className="text-[10px] uppercase tracking-[0.16em] text-muted">{LABELS[role]}</p>{member ? <><h2 className="mt-2 font-display text-2xl">{member.first_name} {member.last_name}</h2><p className="mt-1 text-sm text-carmine-light">Niveau {member.level}/10 · {member.specialty}</p><p className="mt-3 text-xs text-muted">Salaire : {money(member.salary)} / cycle</p></> : <><h2 className="mt-2 font-display text-2xl text-muted">Poste vacant</h2><p className="mt-3 text-xs text-muted">Aucun spécialiste actif.</p></>}<p className="mt-4 border-t border-white/10 pt-4 text-xs text-zinc-300">{EFFECTS[role]}</p></div>; })}</section>
      <section className="rounded-3xl border border-white/10 bg-pitch-900/85 p-5 md:p-6"><div><p className="text-[10px] uppercase tracking-[0.16em] text-muted">Marché du staff</p><h2 className="mt-1 font-display text-3xl">Candidats disponibles</h2></div><div className="mt-5 grid gap-3 lg:grid-cols-2">{data.candidates.map((candidate) => <div key={candidate.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase text-carmine-light">{LABELS[candidate.role]}</p><h3 className="mt-1 font-display text-xl">{candidate.first_name} {candidate.last_name}</h3><p className="mt-1 text-xs text-muted">{candidate.nationality} · Niveau {candidate.level}/10 · {candidate.specialty}</p></div><div className="rounded-xl bg-white/5 px-3 py-2 text-center"><p className="text-[9px] text-muted">Prime</p><p className="font-mono text-xs">{money(candidate.signing_fee)}</p></div></div><div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-muted">Salaire {money(candidate.salary)} / cycle</p><button disabled={busy === candidate.id} onClick={() => hire(candidate.id)} className="rounded-xl bg-carmine px-4 py-2 text-sm font-semibold disabled:opacity-40">{busy === candidate.id ? "Signature…" : staffByRole.has(candidate.role) ? "Remplacer" : "Recruter"}</button></div></div>)}{data.candidates.length === 0 && <p className="text-sm text-muted">Aucun candidat disponible actuellement.</p>}</div></section>
    </>}
  </main></div>;
}
