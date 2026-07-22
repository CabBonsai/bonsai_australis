// app/api/tubestock/route.ts
//
// Server-side proxy for the `tubestock` table, now that RLS is enabled with
// no anon policies. Uses the service role key (supabaseServer.ts) which
// bypasses RLS. The admin app's password gate is the access control here —
// there is no further auth check inside this route, matching how the rest
// of bonsai-admin already works.
//
// CONFIRMED via information_schema: tubestock's real primary key is `id`
// (bigint). `sp_no` exists but is NOT unique per row (multiple tubestock
// batches can share a species), so it's kept only as an optional filter,
// never as the key used for update/delete.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'id';

// GET /api/tubestock             -> all rows
// GET /api/tubestock?id=1234     -> single row by id
// GET /api/tubestock?sp_no=1234  -> all tubestock batches for a species
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const spNo = req.nextUrl.searchParams.get('sp_no');

  let query = supabaseServer.from('tubestock').select('*');
  if (id) query = query.eq(ID_COLUMN, id);
  if (spNo) query = query.eq('sp_no', spNo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/tubestock  body: { sp_no, ...other columns }  (id is auto-generated)
export async function POST(req: NextRequest) {
  const body = await req.json();

  const { data, error } = await supabaseServer
    .from('tubestock')
    .insert(body)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/tubestock  body: { id, ...fields to update }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates = { ...body };
  delete updates[ID_COLUMN];

  const { data, error } = await supabaseServer
    .from('tubestock')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/tubestock?id=1234
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('tubestock')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
