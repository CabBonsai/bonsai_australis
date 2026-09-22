// lib/uploadPdf.ts
//
// Client-side helper for uploading PDFs to the free-downloads bucket via
// the service-role route (app/api/pdf-upload/route.ts). Mirrors the
// pattern in lib/uploadPhoto.ts.
//
// IMPORTANT: Vercel's serverless functions cap request bodies at 4.5MB
// (platform-level -- see the comment in uploadPhoto.ts, discovered when
// photo uploads failed the same way). Unlike a photo, a PDF can't be
// silently resized/recompressed client-side without risking corrupting
// it, so instead of compressing we just check the size up front and give
// a clear, actionable error before ever hitting the network -- rather
// than a cryptic "Request Entity Too Large" failure after the fact.

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 // 4MB, with headroom under Vercel's 4.5MB cap

async function parseResponseSafely(res: Response): Promise<{ error?: string; publicUrl?: string }> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    if (res.status === 413 || /request entity too large/i.test(text)) {
      return { error: 'That PDF is too large to upload (platform limit is ~4.5MB). Try compressing it, e.g. with a free PDF compressor, then upload again.' }
    }
    return { error: `Upload failed (server returned an unexpected response, status ${res.status}).` }
  }
}

export async function uploadPdf(file: File): Promise<string> {
  if (file.type !== 'application/pdf') {
    throw new Error('That file isn\'t a PDF.')
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    throw new Error(`That PDF is ${mb}MB, which is too large to upload directly (platform limit is ~4.5MB). Try compressing it first, e.g. with a free PDF compressor tool.`)
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${Date.now()}_${safeName}`

  const formData = new FormData()
  formData.append('file', file)
  formData.append('bucket', 'free-downloads')
  formData.append('path', path)

  const res = await fetch('/api/pdf-upload', { method: 'POST', body: formData })
  const json = await parseResponseSafely(res)

  if (!res.ok || !json.publicUrl) {
    throw new Error(json.error || 'Upload failed')
  }

  return json.publicUrl
}
