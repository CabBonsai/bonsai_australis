// lib/uploadPhoto.ts
//
// Client-side helper for uploading to the species-photos and tree-photos
// buckets via the service-role route (app/api/photo-upload/route.ts).
// Added [session date] after the RLS audit found both buckets had public
// (anon-writable) INSERT policies on storage.objects, same shape as the
// spotlight-reports issue fixed in session 24. Replaces 5 direct
// supabase.storage.from(bucket).upload(...) call sites that previously
// wrote using the anon key.

export async function uploadPhoto(
  file: File,
  bucket: 'species-photos' | 'tree-photos',
  pathPrefix?: string
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const path = pathPrefix ? `${pathPrefix}${filename}` : filename

  const formData = new FormData()
  formData.append('file', file)
  formData.append('bucket', bucket)
  formData.append('path', path)

  const res = await fetch('/api/photo-upload', { method: 'POST', body: formData })
  const json = await res.json()

  if (!res.ok) {
    throw new Error(json.error || 'Upload failed')
  }

  return json.publicUrl as string
}
