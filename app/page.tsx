'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
const statusColors: Record<string, string> = {
  'Complete': 'bg-green-100 text-green-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Not Started': 'bg-gray-100 text-gray-500',
}
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
    <div className="max-w-2xl mx-auto p-4">
     <div className="flex justify-between items-center mb-1">
        <h1 className="text-2xl font-bold">Bonsai Australis</h1>
        <Link href="/collection" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded">
          My Collection
        </Link>
      </div>
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
          <li key={s.sp_no} className="py-3">
            <Link href={`/species/${s.sp_no}`} className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                {s.reference_photo && (
                  <img src={s.reference_photo} alt={s.species} className="w-12 h-12 object-cover rounded border flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium text-blue-600">{s.species}</p>
                  <p className="text-sm text-gray-500">
                    {s.common_name !== 'Unknown' ? s.common_name : ''}{s.species_family ? ` · ${s.species_family}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 ml-2">
                {s.australian_native && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full whitespace-nowrap">AU Native</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[s.research_status] || 'bg-gray-100 text-gray-500'}`}>
                  {s.research_status || 'Not Started'}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {!loading && species.length === 0 && (
        <p className="text-gray-400 text-center py-8">No species found.</p>
      )}
    </div>
  )
}
