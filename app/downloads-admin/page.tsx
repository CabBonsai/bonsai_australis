'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { uploadPdf } from '@/lib/uploadPdf'

const inputClass = "w-full border rounded px-4 py-3 text-base min-h-[48px]"

type DownloadItem = {
  id: number
  title: string
  description: string | null
  pdf_url: string
  month_label: string | null
  is_published: boolean
  published_at: string | null
}

export default function DownloadsAdmin() {
  const [items, setItems] = useState<DownloadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    setLoading(true)
    const res = await fetch('/api/free-downloads')
    const data = res.ok ? await res.json() : []
    setItems(data || [])
    setLoading(false)
  }

  if (loading) return <main className="max-w-2xl mx-auto p-4"><p>Loading...</p></main>

  if (editingId !== null) {
    const item = editingId === 'new' ? null : items.find(i => i.id === editingId) || null
    return <DownloadEditor item={item} onDone={() => { setEditingId(null); fetchItems() }} />
  }

  return (
    <main className="max-w-2xl mx-auto p-4">
      <Link
        href="/"
        style={{ display: 'inline-block', fontSize: 14, color: '#6b7280', marginBottom: 16, textDecoration: 'none' }}
      >
        &larr; Dashboard
      </Link>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">Free Downloads</h1>
        <button onClick={() => setEditingId('new')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">+ New Download</button>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setEditingId(item.id)}
            className="w-full flex justify-between items-center border rounded-lg p-3 text-left"
          >
            <div>
              <p className="font-medium text-sm">{item.title}</p>
              <p className="text-xs text-gray-400">{item.month_label || 'No month set'}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${item.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {item.is_published ? 'Published' : 'Draft'}
            </span>
          </button>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400">No downloads yet.</p>}
      </div>
    </main>
  )
}

function DownloadEditor({ item, onDone }: { item: DownloadItem | null, onDone: () => void }) {
  const [title, setTitle] = useState(item?.title || '')
  const [description, setDescription] = useState(item?.description || '')
  const [monthLabel, setMonthLabel] = useState(item?.month_label || '')
  const [pdfUrl, setPdfUrl] = useState(item?.pdf_url || '')
  const [isPublished, setIsPublished] = useState(item?.is_published ?? false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const publicUrl = await uploadPdf(file)
      setPdfUrl(publicUrl)
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleSave() {
    if (!title.trim() || !pdfUrl.trim()) {
      alert('Title and a PDF file are required.')
      return
    }
    setSaving(true)
    const payload = {
      title,
      description: description || null,
      month_label: monthLabel || null,
      pdf_url: pdfUrl,
      is_published: isPublished,
      published_at: isPublished ? (item?.published_at || new Date().toISOString()) : item?.published_at || null,
      updated_at: new Date().toISOString(),
    }
    const res = item
      ? await fetch('/api/free-downloads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, ...payload }),
        })
      : await fetch('/api/free-downloads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert('Save failed: ' + (data.error || res.status))
      return
    }
    onDone()
  }

  async function handleDelete() {
    if (!item) return
    if (!confirm('Delete this download permanently? (This removes the listing, not the PDF file itself from Storage.)')) return
    const res = await fetch(`/api/free-downloads?id=${item.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert('Delete failed: ' + (data.error || res.status))
      return
    }
    onDone()
  }

  return (
    <main className="max-w-2xl mx-auto p-4">
      <button onClick={onDone} className="text-sm text-gray-500 mb-4">&larr; Back to list</button>
      <h1 className="text-xl font-semibold mb-4">{item ? 'Edit Download' : 'New Download'}</h1>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Title</span>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} />
      </label>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Description</span>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className={inputClass} />
      </label>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Month label (e.g. &quot;October 2026&quot;)</span>
        <input type="text" value={monthLabel} onChange={e => setMonthLabel(e.target.value)} className={inputClass} />
      </label>

      <div className="mb-3">
        <span className="text-gray-500 block mb-2 text-sm">PDF file</span>
        {pdfUrl && (
          <div className="flex items-center gap-2 mb-2">
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm bg-gray-100 px-3 py-2 rounded text-blue-600 underline">
              View current PDF
            </a>
            <button type="button" onClick={() => setPdfUrl('')} className="text-red-500 text-sm">✕ Remove</button>
          </div>
        )}
        <label className="inline-block bg-gray-100 border rounded px-3 py-2 text-sm cursor-pointer">
          {uploading ? 'Uploading...' : (pdfUrl ? '📄 Replace PDF' : '📄 Upload PDF')}
          <input type="file" accept="application/pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
        <p className="text-xs text-gray-400 mt-1">Max ~4MB per upload (platform limit). Compress larger PDFs first.</p>
      </div>

      <label className="flex items-center gap-2 text-sm mb-6">
        <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
        Published (visible on public site)
      </label>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold w-full text-lg disabled:opacity-50 mb-3"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>

      {item && (
        <button onClick={handleDelete} className="text-red-500 text-sm w-full text-center">
          Delete this download
        </button>
      )}
    </main>
  )
}
