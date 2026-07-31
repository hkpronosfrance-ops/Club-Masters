"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubName: clubName || null }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Erreur de création du club");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen pitch-bg flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 bg-carmine rounded-full" />
            <span className="text-xs tracking-[0.3em] text-muted uppercase font-mono">Saison 01 — En direct</span>
          </div>
          <h1 className="font-display text-5xl font-semibold tracking-tight">
            DYNASTY<span className="text-carmine">ELEVEN</span>
          </h1>
          <p className="text-muted mt-3 text-sm">
            Prends la tête d&apos;un club. Construis une dynastie. Directement dans ton navigateur.
          </p>
        </div>

        <div className="ticket-card bg-pitch-900 border border-pitch-700 p-6">
          <div className="flex gap-1 mb-6 bg-pitch-800 p-1 rounded-md">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-medium rounded transition ${mode === "signup" ? "bg-carmine text-white" : "text-muted"}`}
            >
              Créer mon club
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded transition ${mode === "login" ? "bg-carmine text-white" : "text-muted"}`}
            >
              J&apos;ai déjà un club
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-xs text-muted uppercase tracking-wide">Nom du club (optionnel)</label>
                <input
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="ex. FC Strasbourg Prestige"
                  className="w-full mt-1 bg-pitch-800 border border-pitch-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-carmine"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 bg-pitch-800 border border-pitch-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-carmine"
              />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 bg-pitch-800 border border-pitch-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-carmine"
              />
            </div>

            {error && <p className="text-carmine-light text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-carmine hover:bg-carmine-light transition text-white font-medium py-2.5 rounded disabled:opacity-50"
            >
              {loading ? "Chargement…" : mode === "signup" ? "Prendre les commandes" : "Retour sur le banc"}
            </button>
          </form>
        </div>

        <p className="text-center text-muted text-xs mt-6 font-mono">
          100% navigateur · PC & mobile · Aucune app à installer
        </p>
      </div>
    </main>
  );
}
