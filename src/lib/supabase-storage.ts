import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client for Storage operations. Uses the service-role
// key, so this module must never be imported from a Client Component or any
// code path that ships to the browser.

let cached: SupabaseClient | null = null;

export function getSupabaseStorageClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase storage is not configured (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing).",
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function getReceiptsBucket(): string {
  return process.env.SUPABASE_RECEIPTS_BUCKET ?? "receipts";
}

export function getAvatarsBucket(): string {
  return process.env.SUPABASE_AVATARS_BUCKET ?? "avatars";
}
