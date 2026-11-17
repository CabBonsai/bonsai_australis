import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// Admin-only read (middleware gates /api/** on the admin_auth cookie).
export async function GET(req: NextRequest) {
  const collectionId = req.nextUrl.searchParams.get('collection_id');
  if (!collectionId) return NextResponse.json({ error: 'Missing collection_id' }, { status: 400 });
  const { data, error } = await supabaseServer
    .from('journal_entries').select('*')
    .eq('collection_id', collectionId)
    .order('entry_date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
