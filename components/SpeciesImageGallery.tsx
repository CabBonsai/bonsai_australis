// components/SpeciesImageGallery.tsx  (bonsai-admin)
//
// Same read pattern as the public version (anon client, relies on the
// is_approved=true RLS SELECT policy — every row qualifies today since
// /image-manager only ever inserts approved rows). Adds a Remove button
// that calls the service-role DELETE route, since anon has no delete
// policy on this table.

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type SpeciesImage = {
  id: string
  image_url: string
  thumbnail_url: string | null
  photographer: string | null
  licence: string
  attribution_text: string
  source_page_url: string
}

export default function SpeciesImageGallery({ spNo }: { spNo: string }) {
  const [images, setImages] = useState<SpeciesImage[]>([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('species_images')
      .select('id, image_url, thumbnail_url, photographer, licence, attribution_text, source_page_url')
      .eq('sp_no', spNo)
      .order('imported_at', { ascending: false })
    setImages(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [spNo])

  async function handleRemove(id: string) {
    if (!confirm('Remove this image? This cannot be undone.')) return
    setRemovingId(id)
    try {
      const res = await fetch(`/api/species-images/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setImages(prev => prev.filter(img => img.id !== id))
      } else {
        const data = await res.json().catch(() => ({}))
        alert('Remove failed: ' + (data.error || res.status))
      }
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) return <p style={{ fontSize: '13px', color: '#8a7f5f' }}>Loading images...</p>
  if (images.length === 0) {
    return <p style={{ fontSize: '13px', color: '#8a7f5f' }}>No images sourced yet. Use the Image Manager to find some.</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
      {images.map(img => (
        <div key={img.id} style={{ border: '1px solid #ded4bd', borderRadius: '10px', overflow: 'hidden', background: '#fffdf9' }}>
          <img
            src={img.thumbnail_url || img.image_url}
            alt=""
            style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }}
          />
          <div style={{ padding: '8px 10px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#3f5228', margin: '0 0 2px' }}>{img.licence}</p>
            <p style={{ fontSize: '11px', color: '#8a7f5f', margin: '0 0 8px' }}>{img.photographer || 'Unknown'}</p>
            <button
              onClick={() => handleRemove(img.id)}
              disabled={removingId === img.id}
              style={{
                width: '100%', padding: '5px 0', fontSize: '12px', fontWeight: 600,
                background: '#f5eaea', color: '#a33', border: '1px solid #e0c5c5',
                borderRadius: '6px', cursor: 'pointer',
                opacity: removingId === img.id ? 0.5 : 1,
              }}
            >
              {removingId === img.id ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
