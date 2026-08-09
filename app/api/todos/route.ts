// app/api/todos/route.ts
//
// Server-side proxy for the `todos` table (RLS now enabled, anon full-access
// policy dropped entirely — no anon read or write remains).
// Uses the service role key to bypass RLS for all operations.
//
// Primary key column is `id` (uuid).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'id';

// GET /api/todos       -> all rows, newest first
// GET /api/todos?id=x  -> single row
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  let query = supabaseServer.from('todos').select('*');
  query = id
    ? query.eq(ID_COLUMN, id).single()
    : query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/todos  body: { text }
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body?.text || typeof body.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: '"text" is required' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('todos')
    .insert({ text: body.text.trim(), is_done: false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/todos  body: { id, text?, is_done? }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.text === 'string') updates.text = body.text.trim();
  if (typeof body.is_done === 'boolean') {
    updates.is_done = body.is_done;
    updates.completed_at = body.is_done ? new Date().toISOString() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('todos')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/todos?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('todos')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
