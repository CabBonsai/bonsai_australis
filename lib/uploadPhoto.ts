// lib/uploadPhoto.ts
//
// Client-side helper for uploading to the species-photos and tree-photos
// buckets via the service-role route (app/api/photo-upload/route.ts).
// Added [session date] after the RLS audit found both buckets had public
// (anon-writable) INSERT policies on storage.objects, same shape as the
// spotlight-reports issue fixed in session 24. Replaces 5 direct
// supabase.storage.from(bucket).upload(...) call sites that previously
// wrote using the anon key.
//
// Updated [session date]: real upload from blog-admin failed with
// "Upload failed: Unexpected token 'R', 'Request En'... is not valid JSON".
// Root cause: Vercel's serverless functions cap request bodies at 4.5MB
// (platform-level, not something this route's code controls), and a
// full-resolution phone photo routinely exceeds that. Vercel's edge layer
// rejects the request BEFORE it reaches our route at all, returning plain
// text ("Request Entity Too Large") instead of JSON -- and the old code
// unconditionally called res.json() on every response, so that plain-text
// body threw a cryptic parse error instead of a real message. Two fixes:
// (1) compress/resize the image client-side before upload, so typical
// phone photos land well under the limit instead of hitting it, and
// (2) parse the response safely so any future non-JSON response (platform
// error pages, timeouts, etc.) surfaces a real message instead of a raw
// JSON.parse() failure.

const MAX_DIMENSION = 1920 // px, longest side -- plenty for web display and printed care sheets
const JPEG_QUALITY = 0.82

async function compressImage(file: File): Promise<File> {
  // Skip compression for anything already small, or non-image files (shouldn't
  // happen given the <input accept="image/*"> callers, but be defensive).
  if (!file.type.startsWith('image/') || file.size < 1_000_000) {
    return file
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const targetW = Math.round(bitmap.width * scale)
  const targetH = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) return file // canvas unsupported for some reason -- fall back to the original

  ctx.drawImage(bitmap, 0, 0, targetW, targetH)

  const blob: Blob | null = await new Promise(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  )
  if (!blob) return file // compression failed -- fall back to the original, let the server decide

  // If compression somehow produced something larger (rare, e.g. a tiny
  // already-optimized PNG converted to JPEG), just use the original.
  if (blob.size >= file.size) return file

  const newName = file.name.replace(/\.\w+$/, '') + '.jpg'
  return new File([blob], newName, { type: 'image/jpeg' })
}

async function parseResponseSafely(res: Response): Promise<{ error?: string; publicUrl?: string }> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    // Not JSON -- almost always a platform-level rejection (body too large,
    // gateway timeout, etc.) rather than anything our route's code produced.
    if (res.status === 413 || /request entity too large/i.test(text)) {
      return { error: 'That photo is too large to upload, even after compression. Try a smaller image.' }
    }
    return { error: `Upload failed (server returned an unexpected response, status ${res.status}).` }
  }
}

export async function uploadPhoto(
  file: File,
  bucket: 'species-photos' | 'tree-photos',
  pathPrefix?: string
): Promise<string> {
  const uploadFile = await compressImage(file)

  const ext = uploadFile.type === 'image/jpeg' ? 'jpg' : (uploadFile.name.split('.').pop() || 'jpg')
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const path = pathPrefix ? `${pathPrefix}${filename}` : filename

  const formData = new FormData()
  formData.append('file', uploadFile)
  formData.append('bucket', bucket)
  formData.append('path', path)

  const res = await fetch('/api/photo-upload', { method: 'POST', body: formData })
  const json = await parseResponseSafely(res)

  if (!res.ok || !json.publicUrl) {
    throw new Error(json.error || 'Upload failed')
  }

  return json.publicUrl
}
