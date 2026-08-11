'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const TRAIT_LABELS: { key: string; label: string }[] = [
  { key: 'vigor', label: 'Vigor' },
  { key: 'back_budding_ability', label: 'Back Budding' },
  { key: 'ramification_potential', label: 'Ramification' },
  { key: 'leaf_reduction_potential', label: 'Leaf Reduction' },
  { key: 'root_tolerance_score', label: 'Root Tolerance' },
  { key: 'wire_bend_tolerance', label: 'Wire/Bend' },
  { key: 'nebari_potential_score', label: 'Nebari' },
  { key: 'bark_character_score', label: 'Bark' },
  { key: 'taper_movement_score', label: 'Taper & Movement' },
  { key: 'longevity_score', label: 'Longevity' },
]

export default function DataGapsList() {
  const [species, setSpecies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchList() }, [])

  async function fetchList() {
    setLoading(true)

    const { data: speciesData, error: speciesError } = await supabase
      .from('species')
      .select('sp_no, species, common_name, species_family, australian_native, review_notes')
      .eq('research_status', 'Data Gaps (See Below)')
      .order('species', { ascending: true })

    if (speciesError) {
      setError(speciesError.message)
      setLoading(false)
      return
    }

    const rows = speciesData || []
    const spNos = rows.map(r => r.sp_no)

    const { data: suitData } = spNos.length > 0
      ? await supabase
          .from('bonsai_suitability')
          .select('sp_no, vigor, back_budding_ability, ramification_potential, leaf_reduction_potential, root_tolerance_score, wire_bend_tolerance, nebari_potential_score, bark_character_score, taper_movement_score, longevity_score, research_notes')
          .in('sp_no', spNos)
      : { data: [] }

    const suitMap: Record<number, any> = {}
    for (const s of suitData || []) suitMap[s.sp_no] = s

    const merged = rows.map(r => ({ ...r, suitability: suitMap[r.sp_no] || null }))

    setSpecies(merged)
    setError(null)
    setLoading(false)
  }

  function missingTraits(suit: any): string[] {
    if (!suit) return []
    return TRAIT_LABELS.filter(t => suit[t.key] === null || suit[t.key] === undefined).map(t => t.label)
  }

  function lastNote(notes: string | null): string | null {
    if (!notes) return null
    const parts = notes.split('|').map(p => p.trim()).filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : null
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: '4px' }}>
        <Link href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>&larr; Dashboard</Link>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 0' }}>Data Gaps — Follow-Up List</h1>
      </div>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
        Species marked "Data Gaps (See Below)" — partially researched with a specific, honestly-flagged gap still open. Not a general to-do list; only species deliberately marked this way during research.
      </p>

      {error && <p style={{ color: '#dc2626', marginBottom: '16px' }}>Error: {error}</p>}
      {loading && <p style={{ color: '#9ca3af' }}>Loading...</p>}

      {!loading && !error && (
        <>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
            {species.length} species with an open gap
          </p>

          {species.length === 0 && (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>
              Nothing flagged right now.
            </p>
          )}

          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {species.map(s => {
              const gaps = missingTraits(s.suitability)
              const note = lastNote(s.suitability?.research_notes)
              return (
                <li key={s.sp_no} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Link href={`/species/${s.sp_no}`} style={{ fontWeight: '600', color: '#2563eb', textDecoration: 'none' }}>
                        {s.species}
                      </Link>
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0' }}>
                        {s.common_name && s.common_name !== 'Unknown' ? s.common_name + ' · ' : ''}{s.species_family}
                        {s.australian_native !== null && (s.australian_native ? ' · AU Native' : ' · Not AU Native')}
                      </p>

                      {gaps.length > 0 && (
                        <p style={{ fontSize: '12px', color: '#374151', margin: '8px 0 0' }}>
                          <strong>Missing traits:</strong> {gaps.join(', ')}
                        </p>
                      )}

                      {note && (
                        <p style={{ fontSize: '13px', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '6px 10px', margin: '8px 0 0' }}>
                          {note}
                        </p>
                      )}

                      {s.review_notes && (
                        <p style={{ fontSize: '13px', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '6px 10px', margin: '8px 0 0' }}>
                          {s.review_notes}
                        </p>
                      )}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <Link
                        href={`/species/${s.sp_no}`}
                        style={{ fontSize: '12px', background: '#2563eb', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
