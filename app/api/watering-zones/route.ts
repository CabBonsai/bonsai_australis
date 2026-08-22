import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const VALID_ZONES = [
  'Permanent Water Tray',
  'Frequent/Daily Watering',
  'Moderate-High',
  'Standard/Moderate',
  'Moderate-Drought',
  'Low-Moderate',
  'Low Water/Drought-Tolerant',
  'Isolate - Overwater/Rot Risk',
] as const;

// GET: return every active tree with its current watering zone, species, and common name.
// Note: collection.sp_no has no formal FK to species.sp_no in this schema, so this does
// a manual two-step fetch + merge rather than relying on PostgREST embedded-join syntax.
export async function GET() {
  const { data: trees, error: treesError } = await supabaseServer
    .from('collection')
    .select('tree_number, display_name, watering_zone, sp_no')
    .eq('in_collection', true)
    .order('tree_number', { ascending: true });

  if (treesError) {
    return NextResponse.json({ error: treesError.message }, { status: 500 });
  }

  const spNos = [...new Set((trees ?? []).map((t) => t.sp_no).filter(Boolean))];

  const { data: speciesRows, error: speciesError } = await supabaseServer
    .from('species')
    .select('sp_no, species, common_name')
    .in('sp_no', spNos);

  if (speciesError) {
    return NextResponse.json({ error: speciesError.message }, { status: 500 });
  }

  const speciesMap = new Map(speciesRows?.map((s) => [s.sp_no, s]));

  const merged = (trees ?? []).map((t) => ({
    tree_number: t.tree_number,
    display_name: t.display_name,
    watering_zone: t.watering_zone,
    sp_no: t.sp_no,
    species: speciesMap.get(t.sp_no)?.species ?? null,
    common_name: speciesMap.get(t.sp_no)?.common_name ?? null,
  }));

  return NextResponse.json({ trees: merged });
}

// PATCH: update a single tree's watering zone. Body: { tree_number: number, watering_zone: string | null }
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { tree_number, watering_zone } = body;

  if (typeof tree_number !== 'number') {
    return NextResponse.json({ error: 'tree_number is required' }, { status: 400 });
  }

  if (watering_zone !== null && !VALID_ZONES.includes(watering_zone)) {
    return NextResponse.json({ error: 'Invalid watering_zone value' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from('collection')
    .update({ watering_zone })
    .eq('tree_number', tree_number)
    .select('tree_number, watering_zone')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tree: data });
}
