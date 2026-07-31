"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";

function formatMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} k€`;
  return `${n} €`;
}

export default function TransferMarketPage() {
  const supabase = createClient();
  const [club, setClub] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      .order("listed_price", { ascending: true })
      .limit(50);

    setListings(listed ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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
      setMessage("Transfert conclu ✅");
      await load();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBuyingId(null);
    }
  }

  if (loading) return <div className="min-h-screen pitch-bg flex items-center justify-center text-muted">Chargement…</div>;

  return (
    <div className="min-h-screen pitch-bg pb-24 md:pb-8">
      <Nav />
      <main className="max-w-4xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <h1 className="font-display text-2xl font-semibold">Mercato mondial</h1>
          <span className="font-mono text-gold text-sm">Budget : {formatMoney(club?.balance ?? 0)}</span>
        </div>

        {message && <p className="text-sm text-carmine-light mb-4">{message}</p>}

        <div className="grid gap-2">
          {listings.map((p) => (
            <div
              key={p.id}
              className="bg-pitch-900 border border-pitch-700 rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs font-bold text-carmine-light w-8">{p.position}</span>
                <div>
                  <p className="text-sm font-medium">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-xs text-muted">
                    {p.age} ans · Note {p.overall} · {p.clubs?.name ?? "Club libre"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-gold text-sm">{formatMoney(p.listed_price)}</span>
                <button
                  onClick={() => buy(p.id)}
                  disabled={buyingId === p.id || (club?.balance ?? 0) < p.listed_price}
                  className="bg-carmine hover:bg-carmine-light transition text-white text-sm font-medium px-4 py-1.5 rounded disabled:opacity-40"
                >
                  {buyingId === p.id ? "…" : "Recruter"}
                </button>
              </div>
            </div>
          ))}
          {!listings.length && <p className="text-muted text-sm">Aucun joueur sur le marché pour l&apos;instant.</p>}
        </div>
      </main>
    </div>
  );
}
