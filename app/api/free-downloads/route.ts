// app/api/free-downloads/route.ts
//
// Server-side proxy for `free_downloads`, same reasoning and same pattern
// as app/api/blog-posts/route.ts: RLS on this table only grants anon a
// SELECT policy scoped to is_published = true (correct for the public
// downloads page), so the admin needs the service role key for full CRUD,
// including seeing unpublished drafts in its own list.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'id';

// GET /api/free-downloads        -> all rows (including unpublished), newest first
// GET /api/free-downloads?id=x   -> single row
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  let query = supabaseServer.from('free_downloads').select('*');
  if (id) {
    query = query.eq(ID_COLUMN, id);
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/free-downloads  body: new download fields
export async function POST(req: NextRequest) {
  const body = await req.json();

  const { data, error } = await supabaseServer
    .from('free_downloads')
    .insert(body)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/free-downloads  body: { id, ...fields to update }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates = { ...body };
  delete updates[ID_COLUMN];

  const { data, error } = await supabaseServer
    .from('free_downloads')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/free-downloads?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('free_downloads')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
