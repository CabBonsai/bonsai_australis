// app/api/symptoms/route.ts
//
// Server-side proxy for the `symptoms` table (RLS: anon read-only, no anon
// write policies). Uses the service role key to bypass RLS for writes.
//
// Primary key column is `id` (bigint identity).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'id';

// GET /api/symptoms       -> all rows, grouped by category/display_order
// GET /api/symptoms?id=x  -> single row
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  let query = supabaseServer.from('symptoms').select('*');
  query = id
    ? query.eq(ID_COLUMN, id).single()
    : query.order('category', { ascending: true }).order('display_order', { ascending: true, nullsFirst: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/symptoms  body: { symptom_name, category, description?, image_url?, display_order? }
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body?.symptom_name || !body?.category) {
    return NextResponse.json({ error: '"symptom_name" and "category" are required' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('symptoms')
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/symptoms  body: { id, ...fields to update }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates = { ...body };
  delete updates[ID_COLUMN];

  const { data, error } = await supabaseServer
    .from('symptoms')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/symptoms?id=x  (cascades to symptom_causes and species_symptom_notes)
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('symptoms')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
