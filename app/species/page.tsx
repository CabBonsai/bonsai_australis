'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SpeciesList() {
  const [species, setSpecies] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchSpecies(search)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search])

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

      <input
        type="text"
        placeholder="Search species, common name, genus, or sp_no..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 14px', fontSize: '15px', marginBottom: '16px', boxSizing: 'border-box' }}
      />

      {error && <p style={{ color: '#dc2626', marginBottom: '16px' }}>Error: {error}</p>}
      {loading && <p style={{ color: '#9ca3af' }}>Loading...</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {species.map((s) => (
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
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>No species found.</p>
      )}
    </div>
  )
}
