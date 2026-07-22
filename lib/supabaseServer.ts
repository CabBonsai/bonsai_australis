// lib/supabaseServer.ts
//
// Server-side-only Supabase client. Uses the SERVICE ROLE key, which bypasses
// RLS entirely. This file must NEVER be imported into any client component
// (anything without "use client" is fine; anything with "use client" is NOT).
// It should only be imported inside app/api/**/route.ts files.
//
// Requires an env var SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix) set
// in Vercel project settings (Production + Preview + Development), plus the
// existing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL, either works here since
// this file only ever runs server-side).

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var. ' +
    'Add SUPABASE_SERVICE_ROLE_KEY in Vercel project settings — find the key ' +
    'itself in Supabase dashboard > Project Settings > API > service_role.'
  );
}

export const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
