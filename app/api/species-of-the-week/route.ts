import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

// Writes to species_of_the_week go through this service-role route rather
// than an anon RLS policy — species_of_the_week has SELECT-only RLS (same
// pattern as `variants`), so all INSERT/UPDATE must happen server-side here.
//
// POST   — create a brand new entry and make it the active spotlight
//          (deactivates whatever was previously active first).
// PATCH  — edit an existing entry in place (spiel/photo_url/visible, and
//          optionally re-activate it). Does NOT create a new row.
// GET    — last 20 entries, newest first, joined to species — used both
//          by the admin history list and could be reused publicly if ever
//          needed (currently the public archive queries Supabase directly).

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { sp_no, spiel, photo_url, pdf_url } = body

  if (!sp_no) {
    return NextResponse.json({ error: 'sp_no is required' }, { status: 400 })
  }

  // Deactivate whatever's currently active first — the unique partial index
  // on active=true means a second concurrently-active row would fail the
  // insert, so this has to happen as a separate prior step, not the same
  // statement.
  const { error: deactivateError } = await supabaseServer
    .from('species_of_the_week')
    .update({ active: false })
    .eq('active', true)

  if (deactivateError) {
    return NextResponse.json({ error: deactivateError.message }, { status: 500 })
  }

  const { data, error } = await supabaseServer
    .from('species_of_the_week')
    .insert({ sp_no, spiel, photo_url, pdf_url, active: true, visible: true })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, spiel, photo_url, visible, make_active } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Only re-run the deactivate-then-activate dance if this edit is
  // explicitly re-promoting an old entry back to active — a plain content
  // edit (fixing a typo, hiding an outdated pick) shouldn't touch `active`
  // on any other row.
  if (make_active) {
    const { error: deactivateError } = await supabaseServer
      .from('species_of_the_week')
      .update({ active: false })
      .eq('active', true)

    if (deactivateError) {
      return NextResponse.json({ error: deactivateError.message }, { status: 500 })
    }
  }

  const updatePayload: Record<string, unknown> = {}
  if (spiel !== undefined) updatePayload.spiel = spiel
  if (photo_url !== undefined) updatePayload.photo_url = photo_url
  if (visible !== undefined) updatePayload.visible = visible
  if (make_active) updatePayload.active = true

  const { data, error } = await supabaseServer
    .from('species_of_the_week')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function GET() {
  const { data, error } = await supabaseServer
    .from('species_of_the_week')
    .select('*, species(species, common_name)')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
