import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabase = url && key.startsWith("sb_publishable_")
  ? createClient(url, key, { auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export function accountRedirect(recovery = false): string {
  const target = new URL(import.meta.env.BASE_URL, window.location.origin);
  if (recovery) target.searchParams.set("account", "recovery");
  return target.toString();
}