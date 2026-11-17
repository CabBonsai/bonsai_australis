// app/api/collection/route.ts
//
// Server-side proxy for the `collection` table (RLS now enabled, no anon
// write policies — anon SELECT remains so the app can still read directly).
// Uses the service role key to bypass RLS for INSERT/UPDATE/DELETE.
//
// Primary key column is `collection_id` (uuid).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'collection_id';

// GET /api/collection       -> all rows
// GET /api/collection?id=x  -> single row
// Optional filters (admin pages): select, in_collection=true, active_or_deceased=1,
// ids=a,b,c (collection_id list), sp_no=n, order=col, asc=0|1, single=1.
// Responses for the filtered form are { data } / { error }; the plain forms
// keep their original shape.
const ACTIVE_OR_DECEASED =
  'in_collection.eq.true,status.in.(Deceased,Dead),health_status.in.(Deceased,Dead),location.eq.Deceased';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = sp.get('id');
  const filtered = ['select', 'in_collection', 'active_or_deceased', 'ids', 'sp_no', 'order'].some(k => sp.has(k));

  if (filtered) {
    const cols = sp.get('select') ?? '*';
    if (!/^[A-Za-z0-9_,\s*]+$/.test(cols)) {
      return NextResponse.json({ error: 'Invalid select' }, { status: 400 });
    }
    let q = supabaseServer.from('collection').select(cols);
    if (sp.get('in_collection') === 'true') q = q.eq('in_collection', true);
    if (sp.get('active_or_deceased') === '1') q = q.or(ACTIVE_OR_DECEASED);
    if (sp.has('ids')) q = q.in(ID_COLUMN, sp.get('ids')!.split(',').filter(Boolean));
    if (sp.has('sp_no')) q = q.eq('sp_no', Number(sp.get('sp_no')));
    if (sp.has('order')) {
      const col = sp.get('order')!;
      if (!/^[A-Za-z0-9_]+$/.test(col)) return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
      q = q.order(col, { ascending: sp.get('asc') === '1', nullsFirst: false });
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  let query = supabaseServer.from('collection').select('*');
  if (id) query = query.eq(ID_COLUMN, id).single();

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/collection  body: { ...columns }
export async function POST(req: NextRequest) {
  const body = await req.json();

  const { data, error } = await supabaseServer
    .from('collection')
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/collection  body: { collection_id, ...fields to update }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates = { ...body };
  delete updates[ID_COLUMN];

  const { data, error } = await supabaseServer
    .from('collection')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/collection?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('collection')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
