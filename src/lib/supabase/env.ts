// Accept the Project URL in any form people copy it in ("…supabase.co/", "…supabase.co/rest/v1/"):
// the client only needs the origin.
function originOf(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

export const SUPABASE_URL = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
export const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
