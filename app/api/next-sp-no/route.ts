import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

// Returns the next available sp_no, computed from used_sp_no - the same
// authoritative log the guard_sp_no_reuse() trigger checks against on
// INSERT to species/variants. Added [session 26 date] after finding the
// "Add New Species" form has never actually set sp_no on submit, and
// nothing in the database auto-assigns one (sp_no has no default/identity),
// so every attempt to create a species through that form failed with a
// NOT NULL violation. This route exists so the form can fetch a real,
// guaranteed-unused sp_no immediately before submitting.
//
// Race note: this is a single-operator admin tool, not a multi-user app,
// so the small window between this GET and the subsequent species POST
// isn't guarded against a concurrent second request picking the same
// number - if that ever becomes a real risk (e.g. multiple admins), this
// should move to a single atomic INSERT ... SELECT/sequence instead.
export async function GET() {
  const { data, error } = await supabaseServer
    .from('used_sp_no')
    .select('sp_no')
    .order('sp_no', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ next_sp_no: (data?.sp_no ?? 0) + 1 })
}
