'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// Bonsai-Elite Candidates tab: species with real, promising bonsai evidence
// but not enough breadth across the 10 BAMSR traits to trust a computed score.
// Convention established 2026-09-19 -- see bonsai_suitability.research_status.
// Moved off the main dashboard.

type Candidate = {
  sp_no: number
  species: string
  common_name: string
  research_notes: string
}

export default function EliteCandidatesPage() {
  const [items, setItems] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: promisingData, error: promErr } = await supabase
      .from('bonsai_suitability')
      .select('sp_no, research_notes')
      .eq('research_status', 'Promising -- Insufficient Data to Score')

    if (promErr) {
      setError(promErr.message)
      setLoading(false)
      return
    }

    if (!promisingData || promisingData.length === 0) {
      setItems([])
      setError(null)
      setLoading(false)
      return
    }

    const promSpNos = [...new Set(promisingData.map((p: any) => p.sp_no).filter(Boolean))]
    const promSpeciesMap: Record<number, any> = {}

    const { data: promSpeciesData } = await supabase
      .from('species')
      .select('sp_no, species, common_name')
      .in('sp_no', promSpNos)
    ;(promSpeciesData || []).forEach((s: any) => { promSpeciesMap[s.sp_no] = s })

    // Cultivars/hybrids have their own sp_no in `variants`, not `species`.
    // Look those up too so they show a name (and link to the parent species page).
    const missing = promSpNos.filter((n: any) => !promSpeciesMap[n])
    if (missing.length > 0) {
      const { data: promVariantData } = await supabase
        .from('variants')
        .select('sp_no, variant_name, common_name, parent_sp_no')
        .in('sp_no', missing)
      const parentNos = [...new Set((promVariantData || []).map((v: any) => v.parent_sp_no).filter(Boolean))]
      const parentMap: Record<number, any> = {}
      if (parentNos.length > 0) {
        const { data: parentData } = await supabase.from('species').select('sp_no, species').in('sp_no', parentNos)
        ;(parentData || []).forEach((s: any) => { parentMap[s.sp_no] = s })
      }
      ;(promVariantData || []).forEach((v: any) => {
        const parentName = parentMap[v.parent_sp_no]?.species
        promSpeciesMap[v.sp_no] = {
          sp_no: v.sp_no,
          species: parentName ? `${parentName} '${v.variant_name}'` : v.variant_name,
          common_name: v.common_name,
          link_sp_no: v.parent_sp_no || v.sp_no,
        }
      })
    }

    setItems(promisingData.map((p: any) => ({
      sp_no: promSpeciesMap[p.sp_no]?.link_sp_no ?? p.sp_no,
      species: promSpeciesMap[p.sp_no]?.species || 'Unknown species',
      common_name: promSpeciesMap[p.sp_no]?.common_name || '',
      research_notes: p.research_notes || '',
    })).sort((a: Candidate, b: Candidate) => a.species.localeCompare(b.species)))
    setError(null)
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Bonsai-Elite Candidates</h1>
        <Link href="/" style={{ fontSize: '13px', background: '#f3f4f6', color: '#374151', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
          Dashboard
        </Link>
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: '16px' }}>Error: {error}</p>}
      {loading && <p style={{ color: '#9ca3af' }}>Loading...</p>}

      {!loading && !error && (
        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 4px', color: '#4f46e5' }}>
            Bonsai-Elite Candidates &mdash; {items.length} species
          </h2>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px' }}>
            Real bonsai-relevant evidence found, but not yet enough breadth across the 10 scoring traits to trust a computed score. Worth a dedicated research pass.
          </p>
          {items.length === 0 && (
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '8px 0' }}>No candidates flagged right now.</p>
          )}
          {items.map((item, i) => (
            <Link
              key={`promising-${i}`}
              href={`/species/${item.sp_no}`}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px' }}
            >
              <div style={{ minWidth: 0 }}>
                <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.species}</span>
                {item.common_name && item.common_name !== 'Unknown' && (
                  <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>{item.common_name}</span>
                )}
                {item.research_notes && (
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    margin: '2px 0 0',
                    maxWidth: '600px',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {item.research_notes}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: '700', color: '#4f46e5', margin: 0 }}>Promising</p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
