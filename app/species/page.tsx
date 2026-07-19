'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SpeciesList() {
  const [species, setSpecies] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [topMode, setTopMode] = useState(false)

  useEffect(() => {
    if (topMode) {
      fetchTop300()
      return
    }
    const timeout = setTimeout(() => {
      fetchSpecies(search)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search, topMode])

  async function fetchTop300() {
    setLoading(true)
    const { data: scoreRows, error: scoreErr } = await supabase
      .from('bonsai_suitability')
      .select('sp_no, final_bonsai_score, bonsai_tier, needs_verification')
      .not('final_bonsai_score', 'is', null)
      .order('final_bonsai_score', { ascending: false })
      .limit(300)

    if (scoreErr) {
      setError(scoreErr.message)
      setSpecies([])
      setLoading(false)
      return
    }

    const spNos = (scoreRows || []).map(r => r.sp_no)
    const cols = 'sp_no, species, common_name, species_family, australian_native, research_status, reference_photo'
    const { data: speciesRows, error: speciesErr } = await supabase
      .from('species')
      .select(cols)
      .in('sp_no', spNos)

    if (speciesErr) {
      setError(speciesErr.message)
      setSpecies([])
      setLoading(false)
      return
    }

    const scoreBySpNo = new Map((scoreRows || []).map(r => [r.sp_no, r]))
    const merged = (speciesRows || [])
      .map(s => ({ ...s, ...scoreBySpNo.get(s.sp_no) }))
      .sort((a, b) => (b.final_bonsai_score ?? 0) - (a.final_bonsai_score ?? 0))

    setSpecies(merged)
    setError(null)
    setLoading(false)
  }

  async function fetchSpecies(term: string) {
    setLoading(true)
    const trimmed = term.trim()
    const cols = 'sp_no, species, common_name, species_family, australian_native, research_status, reference_photo'

    // PostgREST's or() combinator can't parse a ::text cast inside a nested logic tree
    // (it works as a standalone filter, but not as one branch of an OR group), so a
    // numeric search term needs its own exact-match query, merged with the text search.
    const isNumeric = trimmed !== '' && /^\d+$/.test(trimmed)

    let textQuery = supabase.from('species').select(cols).order('species', { ascending: true }).limit(50)
    if (trimmed) {
      textQuery = textQuery.or(`species.ilike.%${trimmed}%,common_name.ilike.%${trimmed}%,species_genus.ilike.%${trimmed}%`)
    }

    const [textRes, spNoRes] = await Promise.all([
      textQuery,
      isNumeric
        ? supabase.from('species').select(cols).eq('sp_no', Number(trimmed)).limit(50)
        : Promise.resolve({ data: [] as any[], error: null }),
    ])

    if (textRes.error) {
      setError(textRes.error.message)
    } else if (spNoRes.error) {
      setError(spNoRes.error.message)
    } else {
      const merged = [...(spNoRes.data || []), ...(textRes.data || [])]
      const seen = new Set<number>()
      const deduped = merged.filter(s => (seen.has(s.sp_no) ? false : (seen.add(s.sp_no), true)))
      setSpecies(deduped)
      setError(null)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <div>
          <Link href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>&larr; Dashboard</Link>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 0' }}>Bonsai Australis</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Link href="/species/new" style={{ fontSize: '13px', background: '#16a34a', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            + New Species
          </Link>
          <Link href="/collection" style={{ fontSize: '13px', background: '#2563eb', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            My Collection
          </Link>
          <button
            onClick={async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = '/login' }}
            style={{ fontSize: '13px', background: '#e5e7eb', color: '#374151', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
          >
            Log Out
          </button>
        </div>
      </div>

      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>Species Admin</p>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search species, common name, genus, or sp_no..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={topMode}
          style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 14px', fontSize: '15px', boxSizing: 'border-box', opacity: topMode ? 0.5 : 1 }}
        />
        <button
          onClick={() => setTopMode(t => !t)}
          style={{
            fontSize: '13px',
            fontWeight: 600,
            background: topMode ? '#16a34a' : '#f3f4f6',
            color: topMode ? 'white' : '#374151',
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          🏆 Top 300
        </button>
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: '16px' }}>Error: {error}</p>}
      {loading && <p style={{ color: '#9ca3af' }}>Loading...</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {species.map((s, idx) => (
          <li key={s.sp_no} style={{ borderBottom: '1px solid #e5e7eb' }}>
            <Link href={`/species/${s.sp_no}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                {s.reference_photo && (
                  <img
                    src={s.reference_photo}
                    alt={s.species}
                    style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd', flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: '600', color: '#2563eb', margin: 0 }}>{s.species}</p>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0 0' }}>
                    {s.common_name !== 'Unknown' ? s.common_name : ''}{s.species_family ? ` · ${s.species_family}` : ''}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: '8px', flexShrink: 0 }}>
                {topMode && typeof s.final_bonsai_score === 'number' && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151' }}>
                    #{idx + 1} · {s.final_bonsai_score.toFixed(2)}{s.bonsai_tier ? ` · ${s.bonsai_tier}` : ''}
                  </span>
                )}
                {topMode && s.needs_verification && (
                  <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>Needs Verification</span>
                )}
                {s.australian_native && (
                  <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>AU Native</span>
                )}
                <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                  {s.research_status || 'Not Started'}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {!loading && species.length === 0 && (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>
          {topMode ? 'No scored species found.' : 'No species found.'}
        </p>
      )}
    </div>
  )
}
