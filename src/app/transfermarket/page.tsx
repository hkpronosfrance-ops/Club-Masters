"use client";

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

function getOverallStyle(overall: number) {
  if (overall >= 80) return "text-emerald-300 border-emerald-400/30 bg-emerald-500/10";
  if (overall >= 70) return "text-sky-300 border-sky-400/30 bg-sky-500/10";
  if (overall >= 60) return "text-amber-300 border-amber-400/30 bg-amber-500/10";
  return "text-zinc-200 border-white/10 bg-white/5";
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted">
        <span>{label}</span>
        <span className="font-mono text-zinc-200">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-carmine transition-all" style={{ width: `${Math.max(4, value)}%` }} />
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
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("Tous");
  const [sort, setSort] = useState("price");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
    if (!profile?.club_id) return;

    const { data: clubData } = await supabase.from("clubs").select("*").eq("id", profile.club_id).single();
    setClub(clubData);

    const { data: listed } = await supabase
      .from("players")
      .select("*, clubs!players_club_id_fkey(name)")
      .eq("is_listed", true)
      .neq("club_id", profile.club_id)
      .limit(100);

    setListings(listed ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...listings]
      .filter((player) => {
        const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
        const clubName = (player.clubs?.name ?? "").toLowerCase();
        const matchesQuery = !normalizedQuery || fullName.includes(normalizedQuery) || clubName.includes(normalizedQuery);
        const matchesPosition = position === "Tous" || getPositionGroup(player.position) === position;
        return matchesQuery && matchesPosition;
      })
      .sort((a, b) => {
        if (sort === "overall") return b.overall - a.overall;
        if (sort === "potential") return b.potential - a.potential;
        if (sort === "age") return a.age - b.age;
        return a.listed_price - b.listed_price;
      });
  }, [listings, position, query, sort]);

  async function buy(playerId: string) {
    setBuyingId(playerId);
    setMessage(null);
    try {
      const res = await fetch("/api/transfer/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage("Recrue officialisée. Le joueur a rejoint ton effectif.");
      setExpandedPlayer(null);
      await load();
    } catch (error: any) {
      setMessage(error.message ?? "Le transfert a échoué.");
    } finally {
      setBuyingId(null);
    }
  }

  if (loading) {
    return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Chargement du marché…</div>;
  }

  const filterControls = (
    <>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher joueur ou club…"
        className="field-input"
      />
      <select value={position} onChange={(event) => setPosition(event.target.value)} className="field-input md:min-w-40">
        {["Tous", "Gardien", "Défense", "Milieu", "Attaque"].map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <select value={sort} onChange={(event) => setSort(event.target.value)} className="field-input md:min-w-44">
        <option value="price">Prix croissant</option>
        <option value="overall">Meilleure note</option>
        <option value="potential">Meilleur potentiel</option>
        <option value="age">Plus jeune</option>
      </select>
    </>
  );

  return (
    <div className="min-h-screen pitch-bg pb-28 md:pb-10">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-10">
        <section className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/90 p-4 shadow-2xl shadow-black/20 md:mb-6 md:p-7">
          <div className="absolute inset-y-0 right-0 w-44 bg-[radial-gradient(circle_at_center,rgba(200,30,58,0.24),transparent_70%)]" />
          <div className="relative flex items-center justify-between gap-4 md:items-end">
            <div className="min-w-0">
              <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.24em] text-carmine-light md:mb-2 md:text-[11px]">Cellule de recrutement</p>
              <h1 className="font-display text-2xl font-semibold tracking-tight md:text-4xl">Mercato mondial</h1>
              <p className="mt-2 hidden max-w-xl text-sm leading-6 text-muted md:block">
                Analyse les profils disponibles, compare leur potentiel et renforce ton équipe sans déséquilibrer les finances du club.
              </p>
            </div>
            <div className="shrink-0 rounded-xl border border-gold/20 bg-gold/5 px-3 py-2 text-right md:px-5 md:py-4 md:text-left">
              <p className="text-[8px] uppercase tracking-[0.16em] text-muted md:text-[10px] md:tracking-[0.2em]">Budget</p>
              <p className="mt-0.5 font-mono text-lg text-gold md:mt-1 md:text-2xl">{formatMoney(club?.balance ?? 0)}</p>
            </div>
          </div>
        </section>

        {message && (
          <div className="mb-4 rounded-xl border border-carmine/20 bg-carmine/10 px-4 py-3 text-sm text-carmine-light">
            {message}
          </div>
        )}

        <details className="mb-4 rounded-2xl border border-white/8 bg-pitch-900/70 md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-zinc-200">
            <span>Recherche et filtres</span>
            <span className="text-xs text-muted">{position} · {sort === "price" ? "Prix" : sort === "overall" ? "Note" : sort === "potential" ? "Potentiel" : "Âge"}</span>
          </summary>
          <div className="grid gap-2 border-t border-white/8 p-3">{filterControls}</div>
        </details>

        <section className="mb-5 hidden gap-3 rounded-2xl border border-white/8 bg-pitch-900/70 p-4 md:grid md:grid-cols-[1fr_auto_auto]">
          {filterControls}
        </section>

        <div className="mb-3 flex items-center justify-between md:mb-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted md:text-xs">{filteredListings.length} profils disponibles</p>
          <p className="hidden text-xs text-muted sm:block">Note actuelle et potentiel de progression.</p>
        </div>

        <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
          {filteredListings.map((player) => {
            const canAfford = (club?.balance ?? 0) >= player.listed_price;
            const isExpanded = expandedPlayer === player.id;

            return (
              <article key={player.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-pitch-900/90 shadow-lg shadow-black/10 transition hover:border-carmine/30 md:hover:-translate-y-0.5">
                <div className="flex items-start gap-3 p-3 md:gap-4 md:border-b md:border-white/8 md:p-4">
                  <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border md:h-16 md:w-16 md:rounded-2xl ${getOverallStyle(player.overall)}`}>
                    <span className="font-display text-xl font-semibold leading-none md:text-2xl">{player.overall}</span>
                    <span className="mt-1 text-[8px] uppercase tracking-wider opacity-70 md:text-[9px]">Note</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-white md:text-base">{player.first_name} {player.last_name}</h2>
                        <p className="mt-0.5 truncate text-[11px] text-muted md:mt-1 md:text-xs">{player.clubs?.name ?? "Sans club"}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 font-mono text-[9px] font-bold md:px-2.5 md:text-[10px] ${getPositionStyle(player.position)}`}>
                        {player.position}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-zinc-300 md:mt-3 md:gap-2 md:text-[11px]">
                      <span className="rounded-md bg-white/5 px-2 py-1">{player.age} ans</span>
                      <span className="rounded-md bg-white/5 px-2 py-1">POT {player.potential}</span>
                      <span className="rounded-md bg-white/5 px-2 py-1">Forme {player.form}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-white/8 bg-black/10 px-3 py-3 md:hidden">
                  <div>
                    <p className="text-[8px] uppercase tracking-[0.14em] text-muted">Prix</p>
                    <p className="font-mono text-base text-gold">{formatMoney(player.listed_price)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200"
                  >
                    {isExpanded ? "Réduire" : "Voir profil"}
                  </button>
                  <button
                    onClick={() => buy(player.id)}
                    disabled={buyingId === player.id || !canAfford}
                    className="rounded-lg bg-carmine px-3 py-2 text-xs font-semibold text-white transition hover:bg-carmine-light disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {buyingId === player.id ? "…" : canAfford ? "Recruter" : "Hors budget"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/8 p-3 md:hidden">
                    <StatBar label="Vitesse" value={player.pace} />
                    <StatBar label="Tir" value={player.shooting} />
                    <StatBar label="Passe" value={player.passing} />
                    <StatBar label="Défense" value={player.defending} />
                    <StatBar label="Physique" value={player.physical} />
                    <StatBar label="Fraîcheur" value={100 - player.fatigue} />
                    <div className="col-span-2 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-[11px] text-zinc-300">
                      <span>Moral {player.morale}</span>
                      <span>Forme {player.form}</span>
                      <span>Potentiel {player.potential}</span>
                    </div>
                  </div>
                )}

                <div className="hidden grid-cols-2 gap-x-5 gap-y-3 p-4 sm:grid-cols-3 md:grid">
                  <StatBar label="Vitesse" value={player.pace} />
                  <StatBar label="Tir" value={player.shooting} />
                  <StatBar label="Passe" value={player.passing} />
                  <StatBar label="Défense" value={player.defending} />
                  <StatBar label="Physique" value={player.physical} />
                  <StatBar label="Fraîcheur" value={100 - player.fatigue} />
                </div>

                <div className="hidden items-center justify-between gap-3 border-t border-white/8 bg-black/10 px-4 py-4 md:flex">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Prix demandé</p>
                    <p className="mt-1 font-mono text-lg text-gold">{formatMoney(player.listed_price)}</p>
                  </div>
                  <button
                    onClick={() => buy(player.id)}
                    disabled={buyingId === player.id || !canAfford}
                    className="min-w-28 rounded-xl bg-carmine px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-carmine-light disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {buyingId === player.id ? "Signature…" : canAfford ? "Recruter" : "Hors budget"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {!filteredListings.length && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-pitch-900/50 px-6 py-14 text-center">
            <p className="font-display text-xl">Aucun profil trouvé</p>
            <p className="mt-2 text-sm text-muted">Modifie les filtres ou reviens lorsque de nouveaux joueurs seront mis sur le marché.</p>
          </div>
        )}
      </main>
    </div>
  );
}
