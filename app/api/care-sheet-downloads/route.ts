import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// Admin-only (middleware gates /api/** on the admin_auth cookie).
// Most-downloaded species with data completeness, from the care_sheet_download_ranking view.
export async function GET() {
  const { data, error } = await supabaseServer
    .from('care_sheet_download_ranking')
    .select('*')
    .order('downloads', { ascending: false })
    .order('overall_completeness', { ascending: true, nullsFirst: true })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
