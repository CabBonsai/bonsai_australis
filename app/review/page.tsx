'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ReviewQueue() {
  const [species, setSpecies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<number | null>(null)

  useEffect(() => { fetchQueue() }, [])

  async function fetchQueue() {
    setLoading(true)
    const { data, error } = await supabase
      .from('species')
      .select('sp_no, species, common_name, species_family, australian_native, review_notes')
      .eq('review_status', 'needs_review')
      .order('species', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setSpecies(data || [])
      setError(null)
    }
    setLoading(false)
  }

  async function markConfirmed(sp_no: number) {
    setConfirming(sp_no)
    const { error } = await supabase
      .from('species')
      .update({ review_status: 'confirmed' })
      .eq('sp_no', sp_no)
    if (error) {
      alert('Error: ' + error.message)
    } else {
      setSpecies(prev => prev.filter(s => s.sp_no !== sp_no))
    }
    setConfirming(null)
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: '4px' }}>
        <Link href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>&larr; Dashboard</Link>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 0' }}>Review Queue</h1>
      </div>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
        Species flagged during bulk research runs as uncertain or needing a manual check.
      </p>

      {error && <p style={{ color: '#dc2626', marginBottom: '16px' }}>Error: {error}</p>}
      {loading && <p style={{ color: '#9ca3af' }}>Loading...</p>}

      {!loading && !error && (
        <>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
            {species.length} species awaiting review
          </p>

          {species.length === 0 && (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>
              Nothing in the queue right now.
            </p>
          )}

          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {species.map(s => (
              <li key={s.sp_no} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Link href={`/species/${s.sp_no}`} style={{ fontWeight: '600', color: '#2563eb', textDecoration: 'none' }}>
                      {s.species}
                    </Link>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0' }}>
                      {s.common_name !== 'Unknown' ? s.common_name + ' · ' : ''}{s.species_family}
                      {s.australian_native !== null && (s.australian_native ? ' · AU Native' : ' · Not AU Native')}
                    </p>
                    {s.review_notes && (
                      <p style={{ fontSize: '13px', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '6px 10px', margin: '8px 0 0' }}>
                        {s.review_notes}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <Link
                      href={`/species/${s.sp_no}`}
                      style={{ fontSize: '12px', background: '#2563eb', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => markConfirmed(s.sp_no)}
                      disabled={confirming === s.sp_no}
                      style={{ fontSize: '12px', background: '#16a34a', color: 'white', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                    >
                      {confirming === s.sp_no ? '...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
