// app/api/wishlist-items/route.ts
//
// Server-side proxy for `wishlist_items` (RLS enabled, no anon policies).
// Uses the service role key to bypass RLS.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'id';

// GET /api/wishlist-items                     -> all rows, newest first
// GET /api/wishlist-items?id=x                -> single row
// GET /api/wishlist-items?supplier_id=x       -> rows for one supplier
// GET /api/wishlist-items?sp_no=x             -> rows for one species (any supplier)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const supplierId = req.nextUrl.searchParams.get('supplier_id');
  const spNo = req.nextUrl.searchParams.get('sp_no');

  let query = supabaseServer.from('wishlist_items').select('*');
  if (id) query = query.eq(ID_COLUMN, id);
  if (supplierId) query = query.eq('supplier_id', supplierId);
  if (spNo) query = query.eq('sp_no', spNo);
  query = query.order('date_seen', { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/wishlist-items
// body: { supplier_id, sp_no, size_category, price?, notes?, date_seen?, status? }
// Also accepts { items: [...] } for adding several species from the same
// supplier visit in one call (the genus-ticklist flow).
export async function POST(req: NextRequest) {
  const body = await req.json();

  const rows = Array.isArray(body.items) ? body.items : [body];

  for (const row of rows) {
    if (!row.supplier_id) return NextResponse.json({ error: 'Missing supplier_id' }, { status: 400 });
    if (!row.sp_no) return NextResponse.json({ error: 'Missing sp_no' }, { status: 400 });
    if (!row.size_category) return NextResponse.json({ error: 'Missing size_category' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('wishlist_items')
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/wishlist-items  body: { id, ...fields to update }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates = { ...body, updated_at: new Date().toISOString() };
  delete updates[ID_COLUMN];

  const { data, error } = await supabaseServer
    .from('wishlist_items')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/wishlist-items?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('wishlist_items')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
