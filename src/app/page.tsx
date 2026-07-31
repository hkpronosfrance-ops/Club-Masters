"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Crest, { type CrestShape } from "@/components/Crest";
import { CREST_SHAPES, CREST_COLORS, CREST_SECONDARY_COLORS, CREST_ICONS } from "@/lib/crestOptions";

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [step, setStep] = useState<1 | 2>(1);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clubName, setClubName] = useState("");

  const [shape, setShape] = useState<CrestShape>("shield");
  const [primaryColor, setPrimaryColor] = useState(CREST_COLORS[0]);
  const [secondaryColor, setSecondaryColor] = useState(CREST_SECONDARY_COLORS[0]);
  const [icon, setIcon] = useState<string>(CREST_ICONS[0].key);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToStep2(e: React.FormEvent) {
    e.preventDefault();
    if (!clubName.trim()) {
      setError("Le nom du club est obligatoire.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClub() {
    setLoading(true);
    setError(null);
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubName: clubName.trim(),
          crest: { shape, primaryColor, secondaryColor, icon },
        }),
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

        <div className="ticket-card bg-pitch-900 border border-pitch-700 p-6 shadow-2xl shadow-black/40">
          <div className="flex gap-1 mb-6 bg-pitch-800 p-1 rounded-md">
            <button
              type="button"
              onClick={() => { setMode("signup"); setStep(1); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded transition ${mode === "signup" ? "bg-carmine text-white" : "text-zinc-300 hover:text-white"}`}
            >
              Créer mon club
            </button>
            <button
              type="button"
              onClick={() => { setMode("login"); setStep(1); setError(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded transition ${mode === "login" ? "bg-carmine text-white" : "text-zinc-300 hover:text-white"}`}
            >
              J&apos;ai déjà un club
            </button>
          </div>

          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="Email">
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                />
              </Field>
              <Field label="Mot de passe">
                <input
                  type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="field-input"
                />
              </Field>
              {error && <p className="text-carmine-light text-xs">{error}</p>}
              <button type="submit" disabled={loading} className="w-full bg-carmine hover:bg-carmine-light transition text-white font-medium py-2.5 rounded disabled:opacity-50">
                {loading ? "Chargement…" : "Retour sur le banc"}
              </button>
            </form>
          )}

          {mode === "signup" && step === 1 && (
            <form onSubmit={goToStep2} className="space-y-4">
              <Field label="Nom du club">
                <input
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="ex. FC Strasbourg Prestige"
                  required
                  maxLength={30}
                  className="field-input"
                />
              </Field>
              <Field label="Email">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field-input" />
              </Field>
              <Field label="Mot de passe">
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="field-input" />
              </Field>
              {error && <p className="text-carmine-light text-xs">{error}</p>}
              <button type="submit" className="w-full bg-carmine hover:bg-carmine-light transition text-white font-medium py-2.5 rounded">
                Créer mon club →
              </button>
            </form>
          )}

          {mode === "signup" && step === 2 && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-2 pb-2">
                <Crest shape={shape} primaryColor={primaryColor} secondaryColor={secondaryColor} icon={icon} size={104} />
                <p className="font-display text-lg tracking-tight">{clubName}</p>
              </div>

              <div>
                <p className="field-label mb-2">Forme</p>
                <div className="flex gap-2">
                  {CREST_SHAPES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setShape(s.value as CrestShape)}
                      className={`flex-1 py-2 rounded text-sm transition ${shape === s.value ? "bg-carmine text-white" : "bg-pitch-800 text-zinc-300"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="field-label mb-2">Couleur principale</p>
                <div className="flex gap-2 flex-wrap">
                  {CREST_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPrimaryColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-8 h-8 rounded-full transition ${primaryColor === c ? "ring-2 ring-offset-2 ring-offset-pitch-900 ring-white" : ""}`}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="field-label mb-2">Couleur du contour</p>
                <div className="flex gap-2 flex-wrap">
                  {CREST_SECONDARY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSecondaryColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-8 h-8 rounded-full border border-pitch-600 transition ${secondaryColor === c ? "ring-2 ring-offset-2 ring-offset-pitch-900 ring-white" : ""}`}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="field-label mb-2">Emblème</p>
                <div className="grid grid-cols-4 gap-2">
                  {CREST_ICONS.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIcon(key)}
                      title={label}
                      className={`aspect-square rounded-lg flex items-center justify-center transition ${icon === key ? "bg-carmine text-white" : "bg-pitch-800 text-zinc-300 hover:text-white"}`}
                    >
                      <Icon size={22} strokeWidth={1.6} />
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-carmine-light text-xs">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded text-sm text-muted hover:text-white transition"
                >
                  ← Retour
                </button>
                <button
                  type="button"
                  onClick={handleCreateClub}
                  disabled={loading}
                  className="flex-1 bg-carmine hover:bg-carmine-light transition text-white font-medium py-2.5 rounded disabled:opacity-50"
                >
                  {loading ? "Création…" : "Prendre les commandes"}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-muted text-xs mt-6 font-mono">
          100% navigateur · PC & mobile · Aucune app à installer
        </p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label block mb-1">{label}</label>
      {children}
    </div>
  );
}
