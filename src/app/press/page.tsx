"use client";

import { useEffect, useState } from "react";

type Answer = { label: string; tone: string; morale: number; reputation: number };
type Press = { id: string; context: string; subject: string; question: string; answers: Answer[]; selected_answer?: string; morale_delta?: number; reputation_delta?: number; answered_at?: string };

export default function PressPage() {
  const [pending, setPending] = useState<Press | null>(null);
  const [history, setHistory] = useState<Press[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/press", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) { setPending(data.pending); setHistory(data.history ?? []); }
    else setMessage(data.error ?? "Chargement impossible.");
    setLoading(false);
  }

  async function answer(index: number) {
    if (!pending) return;
    setLoading(true);
    const response = await fetch("/api/press", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pressId: pending.id, answerIndex: index }) });
    const data = await response.json();
    if (!response.ok) setMessage(data.error ?? "Réponse impossible.");
    else {
      setMessage(`Impact : moral ${data.moraleDelta >= 0 ? "+" : ""}${data.moraleDelta}, réputation ${data.reputationDelta >= 0 ? "+" : ""}${data.reputationDelta}.`);
      await load();
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-28 md:px-8">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.25em] text-carmine-light">Médias</p>
        <h1 className="font-display text-4xl font-semibold">Conférence de presse</h1>
        <p className="mt-2 text-muted">Tes déclarations influencent le vestiaire, ta réputation et les gros titres.</p>
      </div>

      {message && <div className="mb-6 rounded-xl border border-pitch-700 bg-pitch-800 p-4 text-sm">{message}</div>}

      {loading && !pending ? <p className="text-muted">Préparation de la salle de presse…</p> : pending && (
        <section className="mb-10 rounded-2xl border border-pitch-700 bg-pitch-800/80 p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <span className="rounded-full bg-carmine/20 px-3 py-1 text-xs text-carmine-light">{pending.context === "pre_match" ? "Avant-match" : pending.context === "post_match" ? "Après-match" : "Vie du club"}</span>
              <h2 className="mt-3 text-2xl font-semibold">{pending.subject}</h2>
            </div>
            <span className="text-4xl">🎙️</span>
          </div>
          <p className="mb-6 text-lg text-white">« {pending.question} »</p>
          <div className="grid gap-3">
            {(pending.answers ?? []).map((item, index) => (
              <button key={index} disabled={loading} onClick={() => answer(index)} className="rounded-xl border border-pitch-700 bg-pitch-900 p-4 text-left transition hover:border-carmine hover:bg-pitch-700 disabled:opacity-50">
                <span className="font-medium">{item.label}</span>
                <span className="mt-1 block text-xs capitalize text-muted">Ton : {item.tone}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-xl font-semibold">Dernières déclarations</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {history.map((item) => (
            <article key={item.id} className="rounded-xl border border-pitch-700 bg-pitch-800 p-5">
              <p className="text-xs uppercase tracking-wider text-carmine-light">{item.subject}</p>
              <p className="mt-2">« {item.selected_answer} »</p>
              <div className="mt-3 flex gap-3 text-xs text-muted">
                <span>Moral {Number(item.morale_delta) >= 0 ? "+" : ""}{item.morale_delta}</span>
                <span>Réputation {Number(item.reputation_delta) >= 0 ? "+" : ""}{item.reputation_delta}</span>
              </div>
            </article>
          ))}
          {!history.length && <p className="text-muted">Aucune déclaration archivée.</p>}
        </div>
      </section>
    </main>
  );
}
