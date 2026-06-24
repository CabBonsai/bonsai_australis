'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Home() {
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
    let query = supabase
      .from('species')
      .select('sp_no, species, common_name, species_family, australian_native, research_status, reference_photo')
      .order('species', { ascending: true })
      .limit(50)
    if (term.trim()) {
      query = query.or(`species.ilike.%${term}%,common_name.ilike.%${term}%,species_genus.ilike.%${term}%`)
    }
    const { data, error } = await query
    if (error) {
      setError(error.message)
    } else {
      setSpecies(data || [])
      setError(null)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Bonsai Australis</h1>
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
        placeholder="Search species, common name, or genus..."
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