// app/api/reminders/route.ts
//
// Server-side proxy for the `reminders` table (RLS enabled, no anon
// policies — every read and write goes through this route using the
// service role key, same pattern as /api/collection).
//
// Columns: id (uuid), title, due_date (date), related, notes,
// completed_date (date, null while open), created_at.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/reminders          -> all reminders
// GET /api/reminders?open=1   -> only reminders not yet completed
export async function GET(req: NextRequest) {
  const openOnly = req.nextUrl.searchParams.get('open') === '1';

  let query = supabaseServer
    .from('reminders')
    .select('*')
    .order('due_date', { ascending: true })
    .order('created_at', { ascending: true });
  if (openOnly) query = query.is('completed_date', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/reminders  body: { title, due_date, related?, notes? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = String(body.title || '').trim();
  const due = String(body.due_date || '');

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!DATE_RE.test(due)) {
    return NextResponse.json({ error: 'due_date must be YYYY-MM-DD' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('reminders')
    .insert({
      title,
      due_date: due,
      related: String(body.related || '').trim() || null,
      notes: String(body.notes || '').trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/reminders  body: { id, title?, due_date?, related?, notes?, completed_date? }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: 'Missing id in request body' }, { status: 400 });

  const updates: Record<string, unknown> = {};

  if ('title' in body) {
    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    updates.title = title;
  }
  if ('due_date' in body) {
    const due = String(body.due_date || '');
    if (!DATE_RE.test(due)) {
      return NextResponse.json({ error: 'due_date must be YYYY-MM-DD' }, { status: 400 });
    }
    updates.due_date = due;
  }
  if ('related' in body) updates.related = String(body.related || '').trim() || null;
  if ('notes' in body) updates.notes = String(body.notes || '').trim() || null;
  if ('completed_date' in body) {
    if (body.completed_date === null) {
      updates.completed_date = null;
    } else {
      const done = String(body.completed_date);
      if (!DATE_RE.test(done)) {
        return NextResponse.json({ error: 'completed_date must be YYYY-MM-DD or null' }, { status: 400 });
      }
      updates.completed_date = done;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('reminders')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/reminders?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });

  const { error } = await supabaseServer.from('reminders').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
