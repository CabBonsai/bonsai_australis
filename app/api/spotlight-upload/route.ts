import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role upload route for the spotlight-reports bucket. Added session 24
// after the RLS/storage-policy audit found spotlight-reports had a public
// (anon-writable) UPDATE policy on storage.objects -- meaning any anonymous
// request with the site's anon key could overwrite any existing spotlight
// file, not just upload new ones. This route replaces the browser's direct
// supabase.storage.from('spotlight-reports').upload(...) call (previously in
// app/species/[sp_no]/page.tsx's generateSpotlightPDF), so uploads/replacements
// only happen server-side, behind the existing admin-app password gate
// (middleware.ts), using the service role key rather than the anon key.
//
// After deploying this route and confirming Species of the Week still works,
// the public/anon INSERT and UPDATE policies on spotlight-reports in
// storage.objects should be dropped, since nothing needs to write to that
// bucket directly from the browser anymore.
//
// NOTE: env var names below (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
// match the convention described for /api/admin-table in session 23's notes --
// double check they match exactly what that route actually uses before deploying,
// in case the real names differ.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { storagePath, pdfBase64 } = await req.json()

    if (!storagePath || !pdfBase64) {
      return NextResponse.json({ error: 'storagePath and pdfBase64 are required' }, { status: 400 })
    }

    // Sanity check so this route can't be pointed at an arbitrary storage
    // path -- expects "<sp_no>_<slug>_spotlight.pdf", matching how
    // generateSpotlightPDF constructs it client-side.
    if (!/^\d+_[a-z0-9_]+_spotlight\.pdf$/.test(storagePath)) {
      return NextResponse.json({ error: 'Invalid storage path format' }, { status: 400 })
    }

    const buffer = Buffer.from(pdfBase64, 'base64')

    const { error: uploadError } = await supabaseAdmin.storage
      .from('spotlight-reports')
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage.from('spotlight-reports').getPublicUrl(storagePath)

    return NextResponse.json({ publicUrl: urlData.publicUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}
