'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const inputClass = "w-full border rounded px-4 py-3 text-base min-h-[48px]"

type Tree = {
  id: number
  sp_no: number | null
  variation_or_cultivar: string | null
  image_url: string | null
  photo_1: string | null
  photo_2: string | null
  photo_3: string | null
  inspiration_photo: string | null
  location: string | null
}

type GalleryEntry = {
  id: number
  title: string
  caption: string | null
  species_display_name: string | null
  sp_no: number | null
  photos: string[]
  sort_order: number
  is_published: boolean
  source_collection_id: number | null
}

export default function GalleryAdmin() {
  const [trees, setTrees] = useState<Tree[]>([])
  const [speciesMap, setSpeciesMap] = useState<Record<number, string>>({})
  const [galleryByCollectionId, setGalleryByCollectionId] = useState<Record<number, GalleryEntry>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingTreeId, setEditingTreeId] = useState<number | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  useEffect(() => { fetchAll() }, [])

 async function fetchAll() {
    setLoading(true)
    const { data: treeData, error: treeError } = await supabase
      .from('collection')
      .select('id, sp_no, variation_or_cultivar, image_url, photo_1, photo_2, photo_3, inspiration_photo, location')
      .order('id', { ascending: false })

    if (treeError) {
      setFetchError(treeError.message)
      setLoading(false)
      return
    }

    const rows = treeData || []
    setTrees(rows)

    const spNos = [...new Set(rows.map(r => r.sp_no).filter(Boolean))] as number[]
    if (spNos.length > 0) {
      const { data: spData } = await supabase.from('species').select('sp_no, species').in('sp_no', spNos)
      const map: Record<number, string> = {}
      for (const s of spData || []) map[s.sp_no] = s.species
      setSpeciesMap(map)
    }

    const { data: galleryData } = await supabase.from('public_gallery').select('*')
    const gMap: Record<number, GalleryEntry> = {}
    for (const g of galleryData || []) {
      if (g.source_collection_id) gMap[g.source_collection_id] = g
    }
    setGalleryByCollectionId(gMap)

    setLoading(false)
  }

  const filtered = trees.filter(t => {
    if (!search.trim()) return true
    const name = speciesMap[t.sp_no || -1] || ''
    const q = search.toLowerCase()
    return name.toLowerCase().includes(q) || (t.variation_or_cultivar || '').toLowerCase().includes(q)
  })

  if (fetchError) return <main className="max-w-2xl mx-auto p-4"><p style={{ color: 'red' }}>Error: {fetchError}</p></main>
  if (loading) return <main className="max-w-2xl mx-auto p-4"><p>Loading...</p></main>

  if (editingTreeId !== null) {
    const tree = trees.find(t => t.id === editingTreeId)
    if (!tree) return null
    return (
      <GalleryEditor
        tree={tree}
        speciesName={speciesMap[tree.sp_no || -1] || ''}
        existing={galleryByCollectionId[tree.id] || null}
        onDone={() => { setEditingTreeId(null); fetchAll() }}
      />
    )
  }

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Public Gallery — Select Trees</h1>
      <input
        type="text"
        placeholder="Search your collection..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className={inputClass + " mb-4"}
      />
      <div className="space-y-2">
        {filtered.map(tree => {
          const published = galleryByCollectionId[tree.id]
          const thumb = tree.image_url || tree.photo_1 || tree.photo_2 || tree.photo_3 || tree.inspiration_photo
          return (
            <button
              key={tree.id}
              onClick={() => setEditingTreeId(tree.id)}
              className="w-full flex items-center gap-3 border rounded-lg p-3 text-left"
            >
              {thumb ? (
                <img src={thumb} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 56, height: 56, background: '#f1f5f9', borderRadius: 8 }} />
              )}
              <div className="flex-1">
                <p className="font-medium text-sm">{speciesMap[tree.sp_no || -1] || 'Unknown species'}</p>
                {tree.variation_or_cultivar && <p className="text-xs text-gray-500">{tree.variation_or_cultivar}</p>}
                {tree.location && <p className="text-xs text-gray-400">{tree.location}</p>}
              </div>
              {published && (
                <span className={`text-xs px-2 py-1 rounded-full ${published.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {published.is_published ? 'Published' : 'Draft'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </main>
  )
}

function GalleryEditor({ tree, speciesName, existing, onDone }: {
  tree: Tree, speciesName: string, existing: GalleryEntry | null, onDone: () => void
}) {
  const availablePhotos = [tree.image_url, tree.photo_1, tree.photo_2, tree.photo_3, tree.inspiration_photo].filter(Boolean) as string[]

  const [title, setTitle] = useState(existing?.title || speciesName)
  const [caption, setCaption] = useState(existing?.caption || '')
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>(existing?.photos || availablePhotos)
  const [sortOrder, setSortOrder] = useState(existing?.sort_order ?? 0)
  const [isPublished, setIsPublished] = useState(existing?.is_published ?? false)
  const [saving, setSaving] = useState(false)

  function togglePhoto(url: string) {
    setSelectedPhotos(prev => prev.includes(url) ? prev.filter(p => p !== url) : [...prev, url])
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      title,
      caption: caption || null,
      species_display_name: speciesName || null,
      sp_no: tree.sp_no,
      photos: selectedPhotos,
      sort_order: sortOrder,
      is_published: isPublished,
      source_collection_id: tree.id,
      updated_at: new Date().toISOString(),
    }
    if (existing) {
      await supabase.from('public_gallery').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('public_gallery').insert(payload)
    }
    setSaving(false)
    onDone()
  }

  async function handleRemove() {
    if (!existing) return
    if (!confirm('Remove this tree from the public gallery?')) return
    await supabase.from('public_gallery').delete().eq('id', existing.id)
    onDone()
  }

  return (
    <main className="max-w-2xl mx-auto p-4">
      <button onClick={onDone} className="text-sm text-gray-500 mb-4">&larr; Back to list</button>
      <h1 className="text-xl font-semibold mb-4">{speciesName}</h1>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Title (shown publicly)</span>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} />
      </label>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Caption</span>
        <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3} className={inputClass} />
      </label>

      <div className="mb-3">
        <span className="text-gray-500 block mb-2 text-sm">Photos to include ({selectedPhotos.length} selected)</span>
        <div className="grid grid-cols-3 gap-2">
          {availablePhotos.map(url => (
            <button
              key={url}
              type="button"
              onClick={() => togglePhoto(url)}
              className="relative"
              style={{ border: selectedPhotos.includes(url) ? '3px solid #5c7a2a' : '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}
            >
              <img src={url} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
              {selectedPhotos.includes(url) && (
                <span style={{ position: 'absolute', top: 4, right: 4, background: '#5c7a2a', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
              )}
            </button>
          ))}
        </div>
        {availablePhotos.length === 0 && <p className="text-sm text-gray-400">No photos on this tree yet. Add some in the Collection detail page first.</p>}
      </div>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Sort order (lower shows first)</span>
        <input type="number" value={sortOrder} onChange={e => setSortOrder(parseInt(e.target.value) || 0)} className={inputClass} />
      </label>

      <label className="flex items-center gap-2 text-sm mb-6">
        <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
        Published (visible on public site)
      </label>

      <button
        onClick={handleSave}
        disabled={saving || selectedPhotos.length === 0}
        className="bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold w-full text-lg disabled:opacity-50 mb-3"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>

      {existing && (
        <button onClick={handleRemove} className="text-red-500 text-sm w-full text-center">
          Remove from gallery
        </button>
      )}
    </main>
  )
}
