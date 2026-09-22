// app/api/pdf-upload/route.ts
//
// Server-side proxy for uploading files to the free-downloads Storage
// bucket, using the service role key. Same reasoning as
// app/api/photo-upload/route.ts (not seen directly when writing this --
// inferred from lib/uploadPhoto.ts's usage and the blog-posts route's
// service-role pattern): uploading directly from the browser with the
// anon key either can't write to the bucket at all, or would need a much
// more permissive (and riskier) storage policy than "admin can upload via
// this route only". Test a real upload before relying on this.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

const ALLOWED_BUCKETS = ['free-downloads'] as const;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const bucket = formData.get('bucket') as string | null;
  const path = formData.get('path') as string | null;

  if (!file || !bucket || !path) {
    return NextResponse.json({ error: 'Missing file, bucket, or path' }, { status: 400 });
  }

  if (!ALLOWED_BUCKETS.includes(bucket as any)) {
    return NextResponse.json({ error: `Bucket "${bucket}" is not allowed via this route` }, { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseServer.storage
    .from(bucket)
    .upload(path, arrayBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrlData } = supabaseServer.storage.from(bucket).getPublicUrl(path);

  return NextResponse.json({ publicUrl: publicUrlData.publicUrl });
}
