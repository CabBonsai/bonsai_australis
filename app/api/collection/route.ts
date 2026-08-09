import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS. Never expose this key to the browser;
// this file only runs server-side (Next.js Route Handler).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/todos — list all todos, newest first
export async function GET() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ todos: data });
}

// POST /api/todos — create a todo
// body: { text: string }
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body?.text || typeof body.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: '"text" is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('todos')
    .insert({ text: body.text.trim(), is_done: false })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ todo: data }, { status: 201 });
}

// PATCH /api/todos — update a todo (toggle done, edit text)
// body: { id: string, text?: string, is_done?: boolean }
export async function PATCH(request: NextRequest) {
  const body = await request.json();

  if (!body?.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: '"id" is required' }, { status: 400 });
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

  const { data, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ todo: data });
}

// DELETE /api/todos?id=... — delete a todo
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: '"id" query param is required' }, { status: 400 });
  }

  const { error } = await supabase.from('todos').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
