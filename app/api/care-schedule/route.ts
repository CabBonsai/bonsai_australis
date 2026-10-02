// app/api/care-schedule/route.ts
//
// Server-side proxy for `care_schedule` (RLS enabled, read-only policy for anon).
// Uses the service role key to bypass RLS, so the browser can add, edit,
// defer, complete and delete care events without opening the table to the world.
//
// Columns on care_schedule:
//   id (int, PK), tree_number (int, FK -> collection), event_type (text),
//   due_date (date, nullable), notes (text), completed_date (date, null = still scheduled),
//   created_at (timestamptz). There is NO updated_at column.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'id';

// Fields a client is allowed to change with PATCH.
const EDITABLE_FIELDS = ['tree_number', 'event_type', 'due_date', 'notes', 'completed_date'] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function badDate(value: unknown): boolean {
  // null / empty string is allowed (clears the date); anything else must be YYYY-MM-DD.
  if (value === null || value === undefined || value === '') return false;
  return typeof value !== 'string' || !DATE_RE.test(value);
}

// GET /api/care-schedule                       -> all rows, soonest due first
// GET /api/care-schedule?id=x                  -> single row
// GET /api/care-schedule?tree_number=x         -> rows for one tree
// GET /api/care-schedule?status=open           -> scheduled only (completed_date is null)
// GET /api/care-schedule?status=done           -> logged only (completed_date is set)
// GET /api/care-schedule?event_type=repot      -> one event type
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const treeNumber = req.nextUrl.searchParams.get('tree_number');
  const status = req.nextUrl.searchParams.get('status');
  const eventType = req.nextUrl.searchParams.get('event_type');

  let query = supabaseServer.from('care_schedule').select('*');
  if (id) query = query.eq(ID_COLUMN, id);
  if (treeNumber) query = query.eq('tree_number', treeNumber);
  if (eventType) query = query.eq('event_type', eventType);
  if (status === 'open') query = query.is('completed_date', null);
  if (status === 'done') query = query.not('completed_date', 'is', null);
  query = query.order('due_date', { ascending: true });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/care-schedule
// body: { tree_number, event_type, due_date?, notes?, completed_date? }
// (due_date is optional in the database, so a note-only event is allowed;
// at least one of due_date or notes must be present.)
// Also accepts { items: [...] } to add several events in one call.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const rows = Array.isArray(body.items) ? body.items : [body];

  for (const row of rows) {
    if (!row.tree_number) return NextResponse.json({ error: 'Missing tree_number' }, { status: 400 });
    if (!row.event_type) return NextResponse.json({ error: 'Missing event_type' }, { status: 400 });
    if (!row.due_date && !(typeof row.notes === 'string' && row.notes.trim())) {
      return NextResponse.json({ error: 'Provide a due_date or notes' }, { status: 400 });
    }
    if (badDate(row.due_date) || badDate(row.completed_date)) {
      return NextResponse.json({ error: 'Dates must be YYYY-MM-DD' }, { status: 400 });
    }
  }

  const clean = rows.map((row: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    for (const f of EDITABLE_FIELDS) {
      if (row[f] !== undefined) out[f] = row[f] === '' ? null : row[f];
    }
    return out;
  });

  const { data, error } = await supabaseServer.from('care_schedule').insert(clean).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/care-schedule  body: { id, ...fields to update }
// Use this to edit, defer (change due_date) or complete (set completed_date) an event.
// Send completed_date: null to move a logged event back to scheduled.
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const f of EDITABLE_FIELDS) {
    if (body[f] !== undefined) updates[f] = body[f] === '' ? null : body[f];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No editable fields in request body' }, { status: 400 });
  }
  if (badDate(updates.due_date) || badDate(updates.completed_date)) {
    return NextResponse.json({ error: 'Dates must be YYYY-MM-DD' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('care_schedule')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: `No care_schedule row with ${ID_COLUMN} ${id}` }, { status: 404 });
  }
  return NextResponse.json(data);
}

// DELETE /api/care-schedule?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('care_schedule')
    .delete()
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: `No care_schedule row with ${ID_COLUMN} ${id}` }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
