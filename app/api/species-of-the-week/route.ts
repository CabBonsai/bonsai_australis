import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

// Writes to species_of_the_week go through this service-role route rather
// than an anon RLS policy — species_of_the_week has SELECT-only RLS (same
// pattern as `variants`), so all INSERT/UPDATE must happen server-side here.

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
    .insert({ sp_no, spiel, photo_url, pdf_url, active: true })
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
