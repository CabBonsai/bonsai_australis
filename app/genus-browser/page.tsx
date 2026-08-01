'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Row = {
  sp_no: number
  name: string
  common_name?: string | null
  kind: 'species' | 'variant'
  parent_species?: string | null
  final_bonsai_score: number | null
  bonsai_tier: string | null
  difficulty: string | null
  needs_verification: boolean | null
}

export default function GenusBrowser() {
  const [allGenera, setAllGenera] = useState<string[]>([])
  const [genusQuery, setGenusQuery] = useState('')
  const [selectedGenus, setSelectedGenus] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loadingGenera, setLoadingGenera] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchGenusList() }, [])

  async function fetchGenusList() {
    setLoadingGenera(true)
    // Previously fetched species_genus for every one of the 8,448 species rows
    // and deduped client-side — silently truncated by PostgREST's 1000-row
    // default limit (no .limit() was set), which returned only the first
    // ~1000 rows in sp_no order, almost entirely Acacia (the largest single
    // genus in the database). Using a dedicated database function instead
    // returns only the ~1,240 distinct genus names directly.
    const { data, error } = await supabase.rpc('get_distinct_genera')
    if (error) {
      setError(error.message)
      setLoadingGenera(false)
      return
    }
    setAllGenera((data || []).map((r: any) => r.genus))
    setLoadingGenera(false)
  }

  async function selectGenus(genus: string) {
    setSelectedGenus(genus)
    setLoadingRows(true)
    setError(null)

    // Species in this genus
    const { data: speciesRows, error: speciesErr } = await supabase
      .from('species')
      .select('sp_no, species, common_name')
      .eq('species_genus', genus)
      .limit(3000)
      .order('species', { ascending: true })

    if (speciesErr) {
      setError(speciesErr.message)
      setLoadingRows(false)
      return
    }

    const speciesSpNos = (speciesRows || []).map(s => s.sp_no)

    // Variants under those species
    const { data: variantRows, error: variantErr } = speciesSpNos.length > 0
      ? await supabase.from('variants').select('sp_no, variant_name, parent_sp_no').in('parent_sp_no', speciesSpNos).limit(3000)
      : { data: [] as any[], error: null }

    if (variantErr) {
      setError(variantErr.message)
      setLoadingRows(false)
      return
    }

    const allSpNos = [...speciesSpNos, ...(variantRows || []).map(v => v.sp_no)]

    // Scores for everything at once
    const { data: scoreRows, error: scoreErr } = allSpNos.length > 0
      ? await supabase
          .from('bonsai_suitability')
          .select('sp_no, final_bonsai_score, bonsai_tier, difficulty, needs_verification')
          .in('sp_no', allSpNos)
          .limit(3000)
      : { data: [] as any[], error: null }

    if (scoreErr) {
      setError(scoreErr.message)
      setLoadingRows(false)
      return
    }

    const scoreBySpNo = new Map((scoreRows || []).map(r => [r.sp_no, r]))
    const speciesNameBySpNo = new Map((speciesRows || []).map(s => [s.sp_no, s.species]))

    const speciesAsRows: Row[] = (speciesRows || []).map(s => {
      const score = scoreBySpNo.get(s.sp_no)
      return {
        sp_no: s.sp_no,
        name: s.species,
        common_name: s.common_name,
        kind: 'species',
        final_bonsai_score: score?.final_bonsai_score ?? null,
        bonsai_tier: score?.bonsai_tier ?? null,
        difficulty: score?.difficulty ?? null,
        needs_verification: score?.needs_verification ?? null,
      }
    })

    const variantAsRows: Row[] = (variantRows || []).map(v => {
      const score = scoreBySpNo.get(v.sp_no)
      return {
        sp_no: v.sp_no,
        name: v.variant_name,
        kind: 'variant',
        parent_species: speciesNameBySpNo.get(v.parent_sp_no) || null,
        final_bonsai_score: score?.final_bonsai_score ?? null,
        bonsai_tier: score?.bonsai_tier ?? null,
        difficulty: score?.difficulty ?? null,
        needs_verification: score?.needs_verification ?? null,
      }
    })

    const merged = [...speciesAsRows, ...variantAsRows].sort((a, b) => {
      const aScore = a.final_bonsai_score ?? -1
      const bScore = b.final_bonsai_score ?? -1
      return bScore - aScore
    })

    setRows(merged)
    setLoadingRows(false)
  }

  const filteredGenera = genusQuery.trim()
    ? allGenera.filter(g => g.toLowerCase().includes(genusQuery.trim().toLowerCase()))
    : allGenera

  const tierColor = (tier: string | null) => {
    if (tier === 'Excellent') return { bg: '#dcfce7', color: '#166534' }
    if (tier === 'Strong') return { bg: '#dbeafe', color: '#1e40af' }
    if (tier === 'Project') return { bg: '#fef3c7', color: '#92400e' }
    if (tier === 'Unsuitable') return { bg: '#fee2e2', color: '#991b1b' }
    return { bg: '#f3f4f6', color: '#6b7280' }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: '4px' }}>
        <Link href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>&larr; Dashboard</Link>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 0' }}>Genus Browser</h1>
      </div>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
        Pick a genus, see every species and variant ranked by BAMSR suitability score.
      </p>

      <input
        type="text"
        placeholder="Search genus (e.g. Acacia, Callistemon)..."
        value={genusQuery}
        onChange={(e) => setGenusQuery(e.target.value)}
        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 14px', fontSize: '15px', boxSizing: 'border-box', marginBottom: '12px' }}
      />

      {loadingGenera && <p style={{ color: '#9ca3af' }}>Loading genus list...</p>}
      {error && <p style={{ color: '#dc2626', marginBottom: '16px' }}>Error: {error}</p>}

      {!loadingGenera && !selectedGenus && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {filteredGenera.slice(0, 60).map(g => (
            <button
              key={g}
              onClick={() => selectGenus(g)}
              style={{ fontSize: '13px', background: '#f3f4f6', color: '#374151', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
            >
              {g}
            </button>
          ))}
          {filteredGenera.length > 60 && (
            <p style={{ fontSize: '13px', color: '#9ca3af', width: '100%', marginTop: '8px' }}>
              {filteredGenera.length - 60} more — narrow your search to see them.
            </p>
          )}
          {filteredGenera.length === 0 && <p style={{ color: '#9ca3af' }}>No matching genus found.</p>}
        </div>
      )}

      {selectedGenus && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{selectedGenus}</h2>
            <button
              onClick={() => { setSelectedGenus(null); setRows([]) }}
              style={{ fontSize: '13px', background: '#f3f4f6', color: '#374151', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
            >
              ← Choose different genus
            </button>
          </div>

          {loadingRows && <p style={{ color: '#9ca3af' }}>Loading...</p>}

          {!loadingRows && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rows.map((r, idx) => {
                const tc = tierColor(r.bonsai_tier)
                return (
                  <li key={`${r.kind}-${r.sp_no}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <Link href={`/species/${r.sp_no}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', textDecoration: 'none' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 600, color: '#2563eb', margin: 0 }}>
                          {r.name}
                          {r.kind === 'variant' && <span style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', marginLeft: '6px' }}>variant</span>}
                        </p>
                        <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0 0' }}>
                          {r.kind === 'species' ? (r.common_name && r.common_name !== 'Unknown' ? r.common_name : '') : `of ${r.parent_species}`}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                          #{idx + 1} · {typeof r.final_bonsai_score === 'number' ? r.final_bonsai_score.toFixed(2) : 'Unscored'}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {r.bonsai_tier && (
                            <span style={{ fontSize: '11px', background: tc.bg, color: tc.color, padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                              {r.bonsai_tier}
                            </span>
                          )}
                          {r.difficulty && (
                            <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                              Difficulty {r.difficulty}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {!loadingRows && rows.length === 0 && (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>No species or variants found for this genus.</p>
          )}
        </>
      )}
    </div>
  )
}
