/**
 * Public Supabase project configuration. A publishable key is safe to expose,
 * but privileged service role/secret keys must never be used in this module.
 */
export function getSupabaseConfig(): { url: string; publishableKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) return null;
    return { url: parsed.toString().replace(/\/$/, ""), publishableKey };
  } catch {
    return null;
  }
}
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
