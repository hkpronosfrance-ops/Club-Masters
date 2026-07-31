import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const QUESTIONS = [
  {
    context: "pre_match",
    subject: "Confiance avant le match",
    question: "Votre équipe semble sous pression. Quel message adressez-vous aux joueurs ?",
    answers: [
      { label: "Je leur fais totalement confiance.", tone: "protective", morale: 4, reputation: 1 },
      { label: "Nous devons prouver notre valeur sur le terrain.", tone: "demanding", morale: 1, reputation: 1 },
      { label: "L’adversaire devrait plutôt s’inquiéter.", tone: "provocative", morale: 2, reputation: -1 },
    ],
  },
  {
    context: "club_event",
    subject: "Ambitions du club",
    question: "Les supporters réclament des résultats immédiats. Que leur répondez-vous ?",
    answers: [
      { label: "Nous construisons un projet durable.", tone: "calm", morale: 1, reputation: 2 },
      { label: "Nous visons les trophées dès maintenant.", tone: "confident", morale: 3, reputation: 1 },
      { label: "La pression extérieure ne change rien.", tone: "provocative", morale: -1, reputation: -1 },
    ],
  },
  {
    context: "post_match",
    subject: "Réaction au dernier résultat",
    question: "Comment jugez-vous la prestation de votre équipe ?",
    answers: [
      { label: "Le groupe a montré un excellent état d’esprit.", tone: "protective", morale: 4, reputation: 1 },
      { label: "Le résultat ne doit pas masquer nos erreurs.", tone: "demanding", morale: -1, reputation: 2 },
      { label: "Nous continuerons à travailler avec calme.", tone: "calm", morale: 2, reputation: 1 },
    ],
  },
] as const;

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("club_id").eq("id", user.id).single();
  if (!profile?.club_id) return null;
  return { user, admin, clubId: profile.club_id };
}

export async function GET() {
  const current = await session();
  if (!current) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const { admin, user, clubId } = current;
  let { data: pending } = await admin.from("press_conferences").select("*").eq("user_id", user.id).is("answered_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!pending) {
    const template = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    const { data } = await admin.from("press_conferences").insert({ user_id: user.id, club_id: clubId, context: template.context, subject: template.subject, question: template.question, answers: template.answers }).select("*").single();
    pending = data;
  }
  const { data: history } = await admin.from("press_conferences").select("*").eq("user_id", user.id).not("answered_at", "is", null).order("answered_at", { ascending: false }).limit(12);
  return NextResponse.json({ pending, history: history ?? [] });
}

export async function POST(request: Request) {
  const current = await session();
  if (!current) return NextResponse.json({ error: "Non authentifié ou aucun club." }, { status: 401 });
  const { admin, user, clubId } = current;
  const body = await request.json().catch(() => ({}));
  const { data: press } = await admin.from("press_conferences").select("*").eq("id", body.pressId).eq("user_id", user.id).is("answered_at", null).single();
  if (!press) return NextResponse.json({ error: "Conférence introuvable ou déjà terminée." }, { status: 404 });
  const answer = Array.isArray(press.answers) ? press.answers[Number(body.answerIndex)] : null;
  if (!answer) return NextResponse.json({ error: "Réponse invalide." }, { status: 400 });

  const moraleDelta = Number(answer.morale ?? 0);
  const reputationDelta = Number(answer.reputation ?? 0);
  await admin.from("press_conferences").update({ selected_answer: answer.label, tone: answer.tone, morale_delta: moraleDelta, reputation_delta: reputationDelta, answered_at: new Date().toISOString() }).eq("id", press.id);

  const { data: players } = await admin.from("players").select("id,morale").eq("club_id", clubId);
  await Promise.all((players ?? []).map((player: any) => admin.from("players").update({ morale: Math.max(0, Math.min(100, Number(player.morale ?? 50) + moraleDelta)) }).eq("id", player.id)));

  const { data: manager } = await admin.from("manager_profiles").select("id,reputation").eq("user_id", user.id).maybeSingle();
  if (manager) await admin.from("manager_profiles").update({ reputation: Math.max(0, Math.min(100, Number(manager.reputation ?? 10) + reputationDelta)), updated_at: new Date().toISOString() }).eq("id", manager.id);

  await admin.from("world_news").insert({ club_id: clubId, category: "club", importance: Math.abs(reputationDelta) >= 2 ? 3 : 2, title: press.subject, body: `Le manager a déclaré : « ${answer.label} »` });
  return NextResponse.json({ success: true, moraleDelta, reputationDelta });
}
