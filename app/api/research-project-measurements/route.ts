// app/api/research-project-measurements/route.ts
//
// Server-side proxy for `research_project_measurements` (RLS enabled, no
// anon policies — same pattern as research-project-trees). Uses the
// service role key to bypass RLS.
//
// This table exists specifically so that ongoing check-ins don't overwrite
// research_project_trees.baseline_* — every remeasurement is its own dated
// row here instead. Only the true first-ever baseline still writes to
// baseline_* via PATCH /api/research-project-trees.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'id';
const TREE_FK = 'project_tree_id';

// GET /api/research-project-measurements                      -> all rows
// GET /api/research-project-measurements?id=x                 -> single row
// GET /api/research-project-measurements?project_tree_id=x    -> rows for one tree, newest first
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const projectTreeId = req.nextUrl.searchParams.get(TREE_FK);

  let query = supabaseServer.from('research_project_measurements').select('*');
  if (id) query = query.eq(ID_COLUMN, id);
  if (projectTreeId) query = query.eq(TREE_FK, projectTreeId);
  query = query.order('measurement_date', { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/research-project-measurements
// body: { project_tree_id, measurement_date, caliper_mm?, height_mm?, notes? }
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body[TREE_FK]) {
    return NextResponse.json({ error: `Missing ${TREE_FK} in request body` }, { status: 400 });
  }
  if (!body.measurement_date) {
    return NextResponse.json({ error: 'Missing measurement_date in request body' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('research_project_measurements')
    .insert(body)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/research-project-measurements  body: { id, ...fields to update }
// (Correcting a mis-entered measurement — not the normal flow.)
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates = { ...body };
  delete updates[ID_COLUMN];

  const { data, error } = await supabaseServer
    .from('research_project_measurements')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/research-project-measurements?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('research_project_measurements')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
