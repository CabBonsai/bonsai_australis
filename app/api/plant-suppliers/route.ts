// app/api/plant-suppliers/route.ts
//
// Server-side proxy for `plant_suppliers` (RLS enabled, no anon policies).
// Uses the service role key to bypass RLS.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'id';

// GET /api/plant-suppliers          -> all rows, alphabetical
// GET /api/plant-suppliers?id=x     -> single row
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  let query = supabaseServer.from('plant_suppliers').select('*');
  if (id) {
    query = query.eq(ID_COLUMN, id);
  } else {
    query = query.order('name', { ascending: true });
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/plant-suppliers  body: { name, location?, notes? }
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: 'Missing name in request body' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('plant_suppliers')
    .insert(body)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/plant-suppliers  body: { id, ...fields to update }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates = { ...body };
  delete updates[ID_COLUMN];

  const { data, error } = await supabaseServer
    .from('plant_suppliers')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/plant-suppliers?id=x
// Cascades to wishlist_items for this supplier (ON DELETE CASCADE).
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('plant_suppliers')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
