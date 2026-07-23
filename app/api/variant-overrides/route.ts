// app/api/variant-overrides/route.ts
//
// Server-side proxy for the `variant_overrides` table (RLS now enabled, no
// anon write policies — anon SELECT remains, and is required since the
// variant_effective_care view now runs as security_invoker and needs the
// querying role to have SELECT on this table directly).
// Uses the service role key to bypass RLS for UPSERT/DELETE.
//
// Primary key column is `sp_no` (integer). This table is always upserted,
// never plain-inserted — a variant may or may not have an overrides row yet.
//
// POST accepts either a single object (used by VariantsSection's per-variant
// Save) or an array of objects (bulk upsert — used by the bulk-edit tool's
// paste-preview-apply tab).

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ID_COLUMN = 'sp_no';

// GET /api/variant-overrides       -> all rows
// GET /api/variant-overrides?id=x  -> single row by sp_no
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  let query = supabaseServer.from('variant_overrides').select('*');
  if (id) query = query.eq(ID_COLUMN, id).single();

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/variant-overrides  body: { sp_no, ...columns }        -> single upsert
// POST /api/variant-overrides  body: [{ sp_no, ...columns }, ...] -> bulk upsert
export async function POST(req: NextRequest) {
  const body = await req.json();
  const rows = Array.isArray(body) ? body : [body];

  const { data, error } = await supabaseServer
    .from('variant_overrides')
    .upsert(rows, { onConflict: ID_COLUMN })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(Array.isArray(body) ? data : data?.[0]);
}

// DELETE /api/variant-overrides?id=x
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from('variant_overrides')
    .delete()
    .eq(ID_COLUMN, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
