import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

// Service-role upload route for the species-photos and tree-photos buckets.
// Added [session date] after the RLS/storage-policy audit found both buckets
// had a public (anon-writable) INSERT policy on storage.objects -- meaning
// any anonymous request with the site's anon key could write into either
// bucket. Same underlying issue as the spotlight-reports fix in session 24
// (see /api/spotlight-upload), just without the UPDATE exposure since these
// two buckets never had a public UPDATE policy.
//
// Replaces 5 direct supabase.storage.from(bucket).upload(...) call sites
// that previously ran client-side with the anon key:
//   - components/JournalSection.tsx (JournalPhotoField, tree-photos)
//   - app/collection/[id]/page.tsx (PhotoField, HeroPhotoField, tree-photos)
//   - app/species/[sp_no]/page.tsx (SpeciesPhotoField, species-photos)
//   - app/blog-admin/page.tsx (handleUpload, tree-photos)
// All five now go through lib/uploadPhoto.ts, which calls this route.
//
// Only species-photos and tree-photos are accepted here -- the bucket name
// is not taken from an arbitrary client value beyond this allowlist, so this
// route can't be pointed at a different bucket than intended.
//
// After deploying this route and confirming uploads still work on the
// species page, a collection tree, a journal entry, and the blog admin
// page, the public/anon INSERT policies on species-photos and tree-photos
// in storage.objects should be dropped, since nothing needs to write to
// either bucket directly from the browser anymore.

const ALLOWED_BUCKETS = ['species-photos', 'tree-photos'] as const
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number]

function isAllowedBucket(value: unknown): value is AllowedBucket {
  return typeof value === 'string' && (ALLOWED_BUCKETS as readonly string[]).includes(value)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const bucket = formData.get('bucket')
    const path = formData.get('path') as string | null

    if (!file || !path) {
      return NextResponse.json({ error: 'file and path are required' }, { status: 400 })
    }
    if (!isAllowedBucket(bucket)) {
      return NextResponse.json({ error: 'Invalid or missing bucket' }, { status: 400 })
    }
    if (path.includes('..') || path.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabaseServer.storage
      .from(bucket)
      .upload(path, buffer, { contentType: file.type || 'application/octet-stream', upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabaseServer.storage.from(bucket).getPublicUrl(path)

    return NextResponse.json({ publicUrl: urlData.publicUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}
