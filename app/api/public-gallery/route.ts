// app/api/public-gallery/route.ts
//
// Server-side proxy for the `public_gallery` table (RLS enabled). The only
// existing policy is anon SELECT where is_published = true -- there is no
// anon INSERT/UPDATE/DELETE policy at all, and no anon SELECT for drafts.
//
// That gap meant app/gallery-admin/page.tsx, which wrote directly via the
// anon client, was silently failing on every save/remove: Postgres applies
// RLS by filtering which rows the statement can even see, so an UPDATE or
// DELETE that doesn't match any RLS-visible row just affects 0 rows with no
// error thrown -- the UI had no error handling either, so it looked like
// every save worked. The admin list view had the same problem in reverse:
// it only ever saw already-published entries, so an unpublished/draft entry
// would vanish from the admin list on next load instead of showing as Draft.
//
// This route uses the service role key to bypass RLS entirely for the admin
// app's reads and writes, same pattern as /api/collection. Public/anon reads
// of published gallery entries keep going straight through the existing RLS
// policy (unaffected by this route).
//
// Primary key column is `id` (bigint, auto-increment).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'id';

// GET /api/public-gallery       -> all rows (published and draft -- admin needs both)
// GET /api/public-gallery?id=x  -> single row
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  let query = supabaseServer.from('public_gallery').select('*');
  if (id) query = query.eq(ID_COLUMN, id).single();

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/public-gallery  body: { ...columns }  (new gallery entry)
export async function POST(req: NextRequest) {
  const body = await req.json();

  const { data, error } = await supabaseServer
    .from('public_gallery')
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/public-gallery  body: { id, ...fields to update }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates = { ...body };
  delete updates[ID_COLUMN];

  const { data, error } = await supabaseServer
    .from('public_gallery')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/public-gallery?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('public_gallery')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
