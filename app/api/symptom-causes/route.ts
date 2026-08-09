// app/api/symptom-causes/route.ts
//
// Server-side proxy for the `symptom_causes` table (RLS: anon read-only, no
// anon write policies). Uses the service role key to bypass RLS for writes.
//
// Primary key column is `id` (bigint identity). Foreign key `symptom_id`
// references symptoms(id).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'id';

// GET /api/symptom-causes?symptom_id=x  -> all causes for one symptom
// GET /api/symptom-causes?id=x          -> single row
// GET /api/symptom-causes               -> all rows (rarely needed; admin overview only)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const symptomId = req.nextUrl.searchParams.get('symptom_id');

  let query = supabaseServer.from('symptom_causes').select('*');
  if (id) {
    query = query.eq(ID_COLUMN, id).single();
  } else if (symptomId) {
    query = query.eq('symptom_id', symptomId).order('likelihood', { ascending: true });
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/symptom-causes  body: { symptom_id, cause_name, likelihood, explanation?, remedy?, distinguishing_signs?, data_source?, research_notes?, needs_verification? }
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body?.symptom_id || !body?.cause_name || !body?.likelihood) {
    return NextResponse.json({ error: '"symptom_id", "cause_name", and "likelihood" are required' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('symptom_causes')
    .insert({ ...body, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/symptom-causes  body: { id, ...fields to update }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const id = body[ID_COLUMN];

  if (!id) {
    return NextResponse.json({ error: `Missing ${ID_COLUMN} in request body` }, { status: 400 });
  }

  const updates = { ...body, updated_at: new Date().toISOString() };
  delete updates[ID_COLUMN];

  const { data, error } = await supabaseServer
    .from('symptom_causes')
    .update(updates)
    .eq(ID_COLUMN, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/symptom-causes?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('symptom_causes')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
