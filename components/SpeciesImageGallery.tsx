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

export default function SpeciesImageGallery({ spNo, onSetReference }: { spNo: string, onSetReference?: (url: string, attribution: string) => void }) {
  const [images, setImages] = useState<SpeciesImage[]>([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [settingId, setSettingId] = useState<string | null>(null)
  const [currentRefUrl, setCurrentRefUrl] = useState<string | null>(null)

  async function load() {
    const [imagesRes, speciesRes] = await Promise.all([
      supabase
        .from('species_images')
        .select('id, image_url, thumbnail_url, photographer, licence, attribution_text, source_page_url')
        .eq('sp_no', spNo)
        .order('imported_at', { ascending: false }),
      supabase.from('species').select('reference_photo').eq('sp_no', spNo).single(),
    ])
    setImages(imagesRes.data || [])
    setCurrentRefUrl(speciesRes.data?.reference_photo || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [spNo])

  async function handleSetReference(img: SpeciesImage) {
    setSettingId(img.id)
    try {
      const res = await fetch('/api/admin-table', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: 'species',
          id: spNo,
          reference_photo: img.image_url,
          reference_photo_attribution: img.attribution_text,
        }),
      })
      if (res.ok) {
        setCurrentRefUrl(img.image_url)
        // Keep the parent page's `species` state in sync -- that state is
        // what the page's main Save button sends back wholesale, and it
        // was previously never updated after this direct save, so hitting
        // Save afterward would silently overwrite this field back to its
        // stale (often null) prior value. Found via a real report: photos
        // appeared to set correctly but reverted after using Save elsewhere
        // on the page.
        onSetReference?.(img.image_url, img.attribution_text)
      } else {
        const data = await res.json().catch(() => ({}))
        alert('Set reference photo failed: ' + (data.error || res.status))
      }
    } finally {
      setSettingId(null)
    }
  }

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
      {images.map(img => {
        const isCurrentRef = currentRefUrl === img.image_url
        return (
        <div key={img.id} style={{ border: isCurrentRef ? '2px solid #7a9c42' : '1px solid #ded4bd', borderRadius: '10px', overflow: 'hidden', background: '#fffdf9' }}>
          <div style={{ position: 'relative' }}>
            <img
              src={img.thumbnail_url || img.image_url}
              alt=""
              style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }}
            />
            {isCurrentRef && (
              <span style={{ position: 'absolute', top: '6px', left: '6px', fontSize: '10px', fontWeight: 700, background: '#7a9c42', color: '#fff', padding: '2px 8px', borderRadius: '999px' }}>
                Reference photo
              </span>
            )}
          </div>
          <div style={{ padding: '8px 10px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#3f5228', margin: '0 0 2px' }}>{img.licence}</p>
            <p style={{ fontSize: '11px', color: '#8a7f5f', margin: '0 0 8px' }}>{img.photographer || 'Unknown'}</p>
            <button
              onClick={() => handleSetReference(img)}
              disabled={isCurrentRef || settingId === img.id}
              style={{
                width: '100%', padding: '5px 0', fontSize: '12px', fontWeight: 600, marginBottom: '6px',
                background: isCurrentRef ? '#eef3e5' : '#eef4e0', color: isCurrentRef ? '#7a9c42' : '#3f5228',
                border: '1px solid #cfe0b0', borderRadius: '6px', cursor: isCurrentRef ? 'default' : 'pointer',
                opacity: settingId === img.id ? 0.5 : 1,
              }}
            >
              {isCurrentRef ? 'Current reference' : settingId === img.id ? 'Setting...' : 'Set as reference'}
            </button>
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
      )})}
    </div>
  )
}
