// app/api/variants/route.ts
//
// Server-side proxy for the `variants` table (RLS now enabled, no anon
// write policies — anon SELECT remains so the app can still read directly).
// Uses the service role key to bypass RLS for INSERT/UPDATE/UPSERT/DELETE.
//
// Primary key column is `sp_no` (integer).
//
// POST accepts either a single object (plain insert — used by the
// "+ Add Variant" button) or an array of objects (bulk upsert keyed on
// sp_no — used by the bulk-edit tool's paste-preview-apply tab).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'sp_no';

// GET /api/variants               -> all rows
// GET /api/variants?id=x          -> single row by sp_no
// GET /api/variants?parent_sp_no=x -> all variants of a parent species
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const parentSpNo = req.nextUrl.searchParams.get('parent_sp_no');

  let query = supabaseServer.from('variants').select('*');
  if (id) query = query.eq(ID_COLUMN, id).single();
  else if (parentSpNo) query = query.eq('parent_sp_no', parentSpNo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/variants  body: { ...columns }              -> single insert
// POST /api/variants  body: [{ ...columns }, ...]        -> bulk upsert on sp_no
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (Array.isArray(body)) {
    const { data, error } = await supabaseServer
      .from('variants')
      .upsert(body, { onConflict: ID_COLUMN })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabaseServer
    .from('variants')
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/variants  body: { sp_no, ...fields to update }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates = { ...body };
  delete updates[ID_COLUMN];

  const { data, error } = await supabaseServer
    .from('variants')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/variants?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('variants')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
