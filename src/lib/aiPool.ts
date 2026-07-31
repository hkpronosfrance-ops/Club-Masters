import { createAdminClient } from "@/lib/supabase/admin";
import { generateSquad, generateAiClubName } from "@/lib/playerGenerator";

const TACTICS = ["offensif", "defensif", "possession", "contre", "balanced"] as const;
const FORMATIONS = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "5-3-2"];

// S'assure qu'il existe un vivier minimum de clubs IA (adversaires + mercato).
// Idempotent : ne recrée rien si le vivier est déjà assez grand.
export async function ensureAiPool(minClubs = 12) {
  const admin = createAdminClient();

  const { count } = await admin
    .from("clubs")
    .select("id", { count: "exact", head: true })
    .eq("is_ai", true);

  const missing = minClubs - (count ?? 0);
  if (missing <= 0) return;

  for (let i = 0; i < missing; i++) {
    const { name, short_name } = generateAiClubName();
    const clubLevel = 40 + Math.floor(Math.random() * 40); // 40-80 : diversité de niveau

    const { data: club, error } = await admin
      .from("clubs")
      .insert({
        owner_id: null,
        is_ai: true,
        name,
        short_name,
        balance: 3_000_000 + Math.floor(Math.random() * 8_000_000),
        reputation: clubLevel,
        formation: FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)],
        tactic_style: TACTICS[Math.floor(Math.random() * TACTICS.length)],
        mentality: 30 + Math.floor(Math.random() * 40),
      })
      .select()
      .single();

    if (error || !club) continue;

    const squad = generateSquad(clubLevel);
    // Quelques joueurs sont mis sur le marché des transferts pour peupler le mercato
    const playersToInsert = squad.map((p) => {
      const willList = Math.random() < 0.25;
      return {
        ...p,
        club_id: club.id,
        is_listed: willList,
        listed_price: willList ? Math.round(p.value * (1 + Math.random() * 0.4)) : null,
      };
    });

    await admin.from("players").insert(playersToInsert);
  }
}
