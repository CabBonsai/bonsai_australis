// app/api/research-project-trees/route.ts
//
// Server-side proxy for `research_project_trees` (RLS enabled, no anon
// policies). Uses the service role key to bypass RLS.
//
// ASSUMPTION: primary key column is `id`, with a `project_id` foreign key
// linking back to research_projects. Adjust ID_COLUMN / PROJECT_FK below
// if the real column names differ.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'id';
const PROJECT_FK = 'project_id';

// GET /api/research-project-trees                 -> all rows
// GET /api/research-project-trees?id=x             -> single row
// GET /api/research-project-trees?project_id=x     -> rows for one project
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const projectId = req.nextUrl.searchParams.get(PROJECT_FK);

  let query = supabaseServer.from('research_project_trees').select('*');
  if (id) query = query.eq(ID_COLUMN, id);
  if (projectId) query = query.eq(PROJECT_FK, projectId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/research-project-trees  body: { project_id, sp_no, ...columns }
export async function POST(req: NextRequest) {
  const body = await req.json();

  const { data, error } = await supabaseServer
    .from('research_project_trees')
    .insert(body)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/research-project-trees  body: { id, ...fields to update }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates = { ...body };
  delete updates[ID_COLUMN];

  const { data, error } = await supabaseServer
    .from('research_project_trees')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/research-project-trees?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('research_project_trees')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
