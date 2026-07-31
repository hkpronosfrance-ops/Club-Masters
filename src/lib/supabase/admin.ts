import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client "admin" — utilise la Service Role Key, UNIQUEMENT côté serveur
// (routes /api/*). Ne jamais importer ce fichier dans un composant client.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
