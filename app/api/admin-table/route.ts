// app/api/admin-table/route.ts
//
// Generic server-side proxy for tables that previously had anon INSERT/UPDATE
// RLS policies granted to the `public` role — a broad vulnerability found and
// closed in session 23 (the Standing Audit Kit's RLS check only ever matched
// literal role 'anon', silently missing every policy granted to 'public',
// which anonymous requests also satisfy). This route uses the service role
// key to bypass RLS after those policies are dropped; access is gated by the
// app's existing middleware (admin_auth cookie check on every non-static
// route), same protection already relied on by /api/variants and
// /api/variant-overrides.
//
// Only tables in ALLOWED_TABLES can be touched — this allowlist is the sole
// thing standing between this route and an arbitrary-table-write primitive,
// so do not relax it without a specific reason.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// table name -> primary key column used for upsert/update/delete targeting
const ALLOWED_TABLES: Record<string, string> = {
  species: 'sp_no',
  bonsai_suitability: 'sp_no',
  care_guide: 'sp_no',
  fertilisation: 'sp_no',
  pruning_protocols: 'sp_no',
  nebari_root: 'sp_no',
  bark_character: 'sp_no',
  taper_movement: 'sp_no',
  tubestock_development: 'sp_no',
  seasonal_maintenance: 'sp_no',
  advanced_expert: 'sp_no',
  regional_suitability: 'sp_no',
  placement_matrix: 'sp_no',
  toxicity: 'sp_no',
  pot_style_matching: 'sp_no',
  journal_entries: 'entry_id',
};

function idColumnFor(table: string): string | null {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TABLES, table) ? ALLOWED_TABLES[table] : null;
}

// POST body: { table: string, rows: object[] } -> bulk upsert on the table's id column
// (a single-element rows array covers plain single-row insert/upsert too)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { table, rows } = body;

  const idColumn = idColumnFor(table);
  if (!idColumn) {
    return NextResponse.json({ error: `Table '${table}' is not in the allowed list` }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Missing or empty rows array' }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from(table)
    .upsert(rows, { onConflict: idColumn })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH body: { table: string, id: string|number, ...fields to update }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { table, id, ...updates } = body;

  const idColumn = idColumnFor(table);
  if (!idColumn) {
    return NextResponse.json({ error: `Table '${table}' is not in the allowed list` }, { status: 400 });
  }
  if (id === undefined || id === null) {
    return NextResponse.json({ error: `Missing id (${idColumn}) in request body` }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from(table)
    .update(updates)
    .eq(idColumn, id)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE ?table=X&id=Y
export async function DELETE(req: NextRequest) {
  const table = req.nextUrl.searchParams.get('table') || '';
  const id = req.nextUrl.searchParams.get('id');

  const idColumn = idColumnFor(table);
  if (!idColumn) {
    return NextResponse.json({ error: `Table '${table}' is not in the allowed list` }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from(table)
    .delete()
    .eq(idColumn, id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
