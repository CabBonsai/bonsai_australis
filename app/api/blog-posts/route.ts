// app/api/blog-posts/route.ts
//
// Server-side proxy for `blog_posts`. RLS on this table only grants anon a
// SELECT policy scoped to is_published = true (correct for the public
// site). The blog-admin page was previously calling the anon client
// directly for its own list/save/delete, which meant: (a) drafts never
// showed up in the admin's own post list, since the anon SELECT can't see
// them, and (b) every insert/update/delete silently had no matching RLS
// policy at all, failing outright ("new row violates row-level security
// policy for table blog_posts"). This route uses the service role key to
// give the admin full CRUD, same pattern as every other admin write route.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'id';

// GET /api/blog-posts        -> all rows (including drafts), newest first
// GET /api/blog-posts?id=x   -> single row
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  let query = supabaseServer.from('blog_posts').select('*');
  if (id) {
    query = query.eq(ID_COLUMN, id);
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/blog-posts  body: new post fields
export async function POST(req: NextRequest) {
  const body = await req.json();

  const { data, error } = await supabaseServer
    .from('blog_posts')
    .insert(body)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/blog-posts  body: { id, ...fields to update }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates = { ...body };
  delete updates[ID_COLUMN];

  const { data, error } = await supabaseServer
    .from('blog_posts')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/blog-posts?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('blog_posts')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
