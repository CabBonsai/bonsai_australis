import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// Admin-only read (middleware gates /api/** on the admin_auth cookie).
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') ?? 'all';
  const club = (req.nextUrl.searchParams.get('club') ?? '').trim();

  let query = supabaseServer
    .from('community_submissions')
    .select('*')
    .order('submitted_at', { ascending: false });
  if (status !== 'all') query = query.eq('status', status);
  if (club) query = query.ilike('club_name', `%${club}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
