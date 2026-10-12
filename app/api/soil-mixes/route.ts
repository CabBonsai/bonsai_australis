// app/api/soil-mixes/route.ts
//
// Named potting mixes. Collection trees point at one through
// collection.soil_mix_id. Uses the service role key (RLS is on, no anon
// policies), like the other admin routes.
//
// GET    /api/soil-mixes          -> every mix, each with the trees using it
// POST   /api/soil-mixes          body: { name, recipe, ... }
// PATCH  /api/soil-mixes          body: { id, ...fields }
// DELETE /api/soil-mixes?id=x     -> refused while trees use it (archive instead)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const TEXT_FIELDS = [
  'name',
  'recipe',
  'organic_percent',
  'intended_for',
  'avoid_for',
  'rationale',
  'status',
  'result_notes',
] as const;

const VALID_STATUS = ['Untested', 'Trialling', 'In use', 'Proven', 'Retired'];

function pickFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) {
    if (f in body) {
      const v = body[f];
      out[f] = typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
    }
  }
  if ('archived' in body) out.archived = body.archived === true;
  return out;
}

export async function GET() {
  const { data: mixes, error } = await supabaseServer
    .from('soil_mixes')
    .select('*')
    .order('archived', { ascending: true })
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: trees, error: treesError } = await supabaseServer
    .from('collection')
    .select('collection_id, tree_number, display_name, soil_mix_id')
    .not('soil_mix_id', 'is', null)
    .eq('in_collection', true)
    .order('tree_number', { ascending: true });

  if (treesError) return NextResponse.json({ error: treesError.message }, { status: 500 });

  const byMix = new Map<string, { collection_id: string; tree_number: number | null; display_name: string | null }[]>();
  for (const t of trees ?? []) {
    const list = byMix.get(t.soil_mix_id) ?? [];
    list.push({ collection_id: t.collection_id, tree_number: t.tree_number, display_name: t.display_name });
    byMix.set(t.soil_mix_id, list);
  }

  return NextResponse.json({
    mixes: (mixes ?? []).map((m) => ({ ...m, trees: byMix.get(m.id) ?? [] })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const fields = pickFields(body);

  if (!fields.name) {
    return NextResponse.json({ error: 'A mix needs a name' }, { status: 400 });
  }
  if (fields.status && !VALID_STATUS.includes(fields.status as string)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('soil_mixes')
    .insert(fields)
    .select()
    .single();

  if (error) {
    const msg = error.code === '23505' ? 'A mix with that name already exists' : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === '23505' ? 409 : 500 });
  }
  return NextResponse.json({ mix: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const fields = pickFields(body);
  if ('name' in fields && !fields.name) {
    return NextResponse.json({ error: 'A mix needs a name' }, { status: 400 });
  }
  if (fields.status && !VALID_STATUS.includes(fields.status as string)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('soil_mixes')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    const msg = error.code === '23505' ? 'A mix with that name already exists' : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === '23505' ? 409 : 500 });
  }

  // Keep the old free-text "Soil Mix Used" field in step when a mix is renamed,
  // so exports and the public side that still read it show the new name.
  if (typeof fields.name === 'string') {
    await supabaseServer
      .from('collection')
      .update({ soil_mix_used: fields.name })
      .eq('soil_mix_id', id);
  }

  return NextResponse.json({ mix: data });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });

  const { count, error: countError } = await supabaseServer
    .from('collection')
    .select('collection_id', { count: 'exact', head: true })
    .eq('soil_mix_id', id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `${count} tree(s) use this mix. Archive it instead of deleting.` },
      { status: 409 }
    );
  }

  const { error } = await supabaseServer.from('soil_mixes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
