"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";

function formatMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)} M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} k€`;
  return `${n} €`;
}

function getPositionGroup(position: string) {
  if (position === "GK") return "Gardien";
  if (["DC", "DL", "DR"].includes(position)) return "Défense";
  if (["MDC", "MC", "MOC"].includes(position)) return "Milieu";
  return "Attaque";
}

function getPositionStyle(position: string) {
  if (position === "GK") return "bg-violet-500/15 text-violet-300 border-violet-400/20";
  if (["DC", "DL", "DR"].includes(position)) return "bg-sky-500/15 text-sky-300 border-sky-400/20";
  if (["MDC", "MC", "MOC"].includes(position)) return "bg-amber-500/15 text-amber-300 border-amber-400/20";
  return "bg-rose-500/15 text-rose-300 border-rose-400/20";
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.14em] text-muted">
        <span>{label}</span><span className="font-mono text-zinc-200">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-carmine" style={{ width: `${Math.max(4, value)}%` }} />
      </div>
    </div>
  );
}

export default function TransferMarketPage() {
  const supabase = createClient();
  const [club, setClub] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("Tous");
  const [sort, setSort] = useState("price");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [confirmPlayer, setConfirmPlayer] = useState<any | null>(null);
  const [signedPlayer, setSignedPlayer] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
    if (!profile?.club_id) return;

    const [{ data: clubData }, { data: listed }] = await Promise.all([
      supabase.from("clubs").select("*").eq("id", profile.club_id).single(),
      supabase.from("players").select("*, clubs!players_club_id_fkey(name)").eq("is_listed", true).neq("club_id", profile.club_id).limit(100),
    ]);

    setClub(clubData);
    setListings(listed ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...listings]
      .filter((player) => {
        const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
        const clubName = (player.clubs?.name ?? "").toLowerCase();
        return (!normalizedQuery || fullName.includes(normalizedQuery) || clubName.includes(normalizedQuery))
          && (position === "Tous" || getPositionGroup(player.position) === position);
      })
      .sort((a, b) => {
        if (sort === "overall") return b.overall - a.overall;
        if (sort === "potential") return b.potential - a.potential;
        if (sort === "age") return a.age - b.age;
        return a.listed_price - b.listed_price;
      });
  }, [listings, position, query, sort]);

  async function confirmBuy() {
    if (!confirmPlayer) return;
    setBuyingId(confirmPlayer.id);
    setError(null);
    try {
      const res = await fetch("/api/transfer/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: confirmPlayer.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Le transfert a échoué.");
      const recruited = confirmPlayer;
      setConfirmPlayer(null);
      setSignedPlayer(recruited);
      setExpandedPlayer(null);
      await load();
    } catch (e: any) {
      setError(e.message ?? "Le transfert a échoué.");
    } finally {
      setBuyingId(null);
    }
  }

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Chargement du marché…</div>;

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-10">
        <section className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/90 p-4 shadow-2xl md:mb-6 md:p-7">
          <div className="absolute inset-y-0 right-0 w-44 bg-[radial-gradient(circle_at_center,rgba(200,30,58,0.24),transparent_70%)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.24em] text-carmine-light md:text-[11px]">Cellule de recrutement</p>
              <h1 className="font-display text-2xl font-semibold md:text-4xl">Mercato mondial</h1>
            </div>
            <div className="shrink-0 rounded-xl border border-gold/20 bg-gold/5 px-3 py-2 text-right md:px-5 md:py-4">
              <p className="text-[8px] uppercase tracking-[0.16em] text-muted md:text-[10px]">Budget</p>
              <p className="font-mono text-lg text-gold md:text-2xl">{formatMoney(club?.balance ?? 0)}</p>
            </div>
          </div>
        </section>

        {error && <div className="mb-4 rounded-xl border border-carmine/25 bg-carmine/10 px-4 py-3 text-sm text-carmine-light">{error}</div>}

        <details className="mb-4 rounded-2xl border border-white/8 bg-pitch-900/70 md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-zinc-200">
            <span>Recherche et filtres</span><span className="text-xs text-muted">{position}</span>
          </summary>
          <div className="grid gap-2 border-t border-white/8 p-3"><Filters query={query} setQuery={setQuery} position={position} setPosition={setPosition} sort={sort} setSort={setSort} /></div>
        </details>

        <section className="mb-5 hidden gap-3 rounded-2xl border border-white/8 bg-pitch-900/70 p-4 md:grid md:grid-cols-[1fr_auto_auto]">
          <Filters query={query} setQuery={setQuery} position={position} setPosition={setPosition} sort={sort} setSort={setSort} />
        </section>

        <p className="mb-3 text-[10px] uppercase tracking-[0.16em] text-muted md:mb-4 md:text-xs">{filteredListings.length} profils disponibles</p>

        <div className="grid gap-3 lg:grid-cols-2">
          {filteredListings.map((player) => {
            const canAfford = (club?.balance ?? 0) >= player.listed_price;
            const expanded = expandedPlayer === player.id;
            return (
              <article key={player.id} className="overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/90">
                <div className="flex items-start gap-3 p-3 md:p-4">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 md:h-16 md:w-16">
                    <span className="font-display text-xl font-semibold md:text-2xl">{player.overall}</span>
                    <span className="text-[8px] uppercase text-muted">Note</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold md:text-base">{player.first_name} {player.last_name}</h2>
                        <p className="mt-1 truncate text-[11px] text-muted">{player.clubs?.name ?? "Sans club"}</p>
                      </div>
                      <span className={`h-fit rounded-full border px-2 py-1 font-mono text-[9px] font-bold ${getPositionStyle(player.position)}`}>{player.position}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-zinc-300">
                      <span className="rounded-md bg-white/5 px-2 py-1">{player.age} ans</span>
                      <span className="rounded-md bg-white/5 px-2 py-1">POT {player.potential}</span>
                      <span className="rounded-md bg-white/5 px-2 py-1">Forme {player.form}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-white/8 bg-black/10 px-3 py-3">
                  <div><p className="text-[8px] uppercase tracking-[0.14em] text-muted">Prix</p><p className="font-mono text-base text-gold">{formatMoney(player.listed_price)}</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => setExpandedPlayer(expanded ? null : player.id)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200">{expanded ? "Réduire" : "Stats"}</button>
                    <Link href={`/players/${player.id}`} className="hidden rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 sm:block">Profil</Link>
                    <button onClick={() => setConfirmPlayer(player)} disabled={!canAfford} className="rounded-lg bg-carmine px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{canAfford ? "Recruter" : "Hors budget"}</button>
                  </div>
                </div>

                {expanded && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/8 p-3 sm:grid-cols-3">
                    <StatBar label="Vitesse" value={player.pace} /><StatBar label="Tir" value={player.shooting} /><StatBar label="Passe" value={player.passing} />
                    <StatBar label="Défense" value={player.defending} /><StatBar label="Physique" value={player.physical} /><StatBar label="Fraîcheur" value={100 - player.fatigue} />
                    <Link href={`/players/${player.id}`} className="col-span-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-zinc-200 sm:col-span-3">Ouvrir le profil complet</Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </main>

      {confirmPlayer && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-pitch-900 p-5 shadow-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-carmine-light">Validation du transfert</p>
            <h2 className="mt-2 font-display text-3xl">Recruter {confirmPlayer.first_name} {confirmPlayer.last_name} ?</h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Summary label="Prix du transfert" value={formatMoney(confirmPlayer.listed_price)} />
              <Summary label="Budget restant" value={formatMoney((club?.balance ?? 0) - confirmPlayer.listed_price)} />
              <Summary label="Note" value={String(confirmPlayer.overall)} />
              <Summary label="Potentiel" value={String(confirmPlayer.potential)} />
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">Le transfert sera définitif et le joueur rejoindra immédiatement ton effectif.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmPlayer(null)} disabled={buyingId === confirmPlayer.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">Annuler</button>
              <button onClick={confirmBuy} disabled={buyingId === confirmPlayer.id} className="rounded-xl bg-carmine px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{buyingId === confirmPlayer.id ? "Signature…" : "Confirmer"}</button>
            </div>
          </div>
        </div>
      )}

      {signedPlayer && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-carmine/30 bg-pitch-900 p-7 text-center shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(200,30,58,0.28),transparent_55%)]" />
            <div className="relative">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-display text-4xl text-gold">{signedPlayer.overall}</div>
              <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.28em] text-carmine-light">Bienvenue au club</p>
              <h2 className="mt-2 font-display text-4xl">{signedPlayer.first_name} {signedPlayer.last_name}</h2>
              <p className="mt-2 text-sm text-muted">Le contrat est signé. Ta nouvelle recrue est disponible dans l’effectif.</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button onClick={() => setSignedPlayer(null)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">Continuer</button>
                <Link href={`/players/${signedPlayer.id}`} className="rounded-xl bg-carmine px-4 py-3 text-sm font-semibold text-white">Voir la recrue</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Filters({ query, setQuery, position, setPosition, sort, setSort }: any) {
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher joueur ou club…" className="field-input" />
      <select value={position} onChange={(e) => setPosition(e.target.value)} className="field-input md:min-w-40">{["Tous", "Gardien", "Défense", "Milieu", "Attaque"].map((item) => <option key={item}>{item}</option>)}</select>
      <select value={sort} onChange={(e) => setSort(e.target.value)} className="field-input md:min-w-44"><option value="price">Prix croissant</option><option value="overall">Meilleure note</option><option value="potential">Meilleur potentiel</option><option value="age">Plus jeune</option></select>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-[9px] uppercase tracking-[0.14em] text-muted">{label}</p><p className="mt-1 font-mono text-sm text-white">{value}</p></div>;
}
