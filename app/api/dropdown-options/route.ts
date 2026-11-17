import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// Admin-only (middleware gates /api/** on the admin_auth cookie).
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category');
  if (!category) return NextResponse.json({ error: 'Missing category' }, { status: 400 });
  const { data, error } = await supabaseServer
    .from('dropdown_options').select('value').eq('category', category);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { category, value } = await req.json();
  if (!category || !value || typeof value !== 'string') {
    return NextResponse.json({ error: 'Missing category or value' }, { status: 400 });
  }
  const { error } = await supabaseServer
    .from('dropdown_options')
    .upsert({ category, value: value.trim() }, { onConflict: 'category,value' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
