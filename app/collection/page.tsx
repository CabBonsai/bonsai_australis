'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export default function CollectionPage() {
  const [trees, setTrees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchTrees()
  }, [])

  async function fetchTrees() {
    setLoading(true)
    const { data } = await supabase
      .from('collection_detail')
      .select('*')
      .order('display_name', { ascending: true })

    setTrees(data || [])
    setLoading(false)
  }

  async function handleAddTree() {
    const { data, error } = await supabase
      .from('collection')
      .insert({ display_name: 'New Tree', in_collection: true })
      .select()
      .single()

    if (error) {
      alert('Error creating tree: ' + error.message)
      return
    }

    window.location.href = `/collection/${data.collection_id}`
  }

  const filtered = trees.filter(t =>
    !search.trim() ||
    (t.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.tree_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.species || '').toLowerCase().includes(search.toLowerCase())
  )

  function isOverdue(dateStr: string | null) {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Bonsai Collection</h1>
        <button
          onClick={handleAddTree}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
        >
          + Add Tree
        </button>
      </div>

      <input
        type="text"
        placeholder="Search your collection..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border rounded-lg px-4 py-3 mb-6 text-lg"
      />

      {loading && <p className="text-gray-400">Loading...</p>}

      {!loading && (
        <>
          <p className="text-sm text-gray-400 mb-4">{filtered.length} trees</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map(t => {
              const overdueRepot = isOverdue(t.next_repot_due)
              const overdueFert = isOverdue(t.next_fertilise_due)
              const hasOverdue = overdueRepot || overdueFert

              return (
                <a
                  key={t.collection_id}
                  href={`/collection/${t.collection_id}`}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow block relative"
                >
                  {hasOverdue && (
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full" title="Care overdue" />
                  )}
                  {t.image_url && (
                    <img src={t.image_url} alt={t.display_name} className="w-full h-32 object-cover rounded mb-2" />
                  )}
                  <h2 className="font-semibold">{t.display_name || t.tree_name || 'Unnamed'}</h2>
                  {t.species && <p className="text-sm text-gray-500 italic">{t.species}</p>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {t.status && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t.status}</span>
                    )}
                    {t.health_status && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">{t.health_status}</span>
                    )}
                  </div>
                </a>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <p className="text-gray-400 text-center py-12">No trees found. Click "+ Add Tree" to get started.</p>
          )}
        </>
      )}
    </main>
  )
}