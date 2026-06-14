'use client'

import { useEffect, useState } from 'react'
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
      .select('sp_no, species, common_name, species_genus, species_family, australian_native')
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
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-1">Bonsai Australis</h1>
      <p className="text-sm text-gray-500 mb-4">Species Admin</p>

      <input
        type="text"
        placeholder="Search species, common name, or genus..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-4 py-3 mb-4 text-base"
      />

      {error && <p className="text-red-600 mb-4">Error: {error}</p>}
      {loading && <p className="text-gray-400">Loading...</p>}

      <ul className="divide-y">
        {species.map((s) => (
          <li key={s.sp_no} className="py-3 flex justify-between items-center">
            <div>
              <p className="font-medium">{s.species}</p>
              <p className="text-sm text-gray-500">
                {s.common_name !== 'Unknown' ? s.common_name : ''} {s.species_family ? `· ${s.species_family}` : ''}
              </p>
            </div>
            {s.australian_native && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                AU Native
              </span>
            )}
          </li>
        ))}
      </ul>

      {!loading && species.length === 0 && (
        <p className="text-gray-400 text-center py-8">No species found.</p>
      )}
    </div>
  )
}