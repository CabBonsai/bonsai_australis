'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

export default function CollectionPage() {
  const [trees, setTrees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [speciesSearch, setSpeciesSearch] = useState('')
  const [speciesResults, setSpeciesResults] = useState<any[]>([])
  const [speciesLoading, setSpeciesLoading] = useState(false)
  const [selectedSpecies, setSelectedSpecies] = useState<any>(null)
  const [adding, setAdding] = useState(false)
  const searchRef = useRef<any>(null)

  // --- Filter state ---
  const [showFilters, setShowFilters] = useState(false)
  const [filterGenus, setFilterGenus] = useState('')
  const [filterOrigin, setFilterOrigin] = useState<'all' | 'native' | 'exotic'>('all')
  const [filterFrost, setFilterFrost] = useState<'all' | 'required'>('all')

  useEffect(() => { fetchTrees() }, [])

  useEffect(() => {
    if (!showAddModal) {
      setSpeciesSearch('')
      setSpeciesResults([])
      setSelectedSpecies(null)
    } else {
      setTimeout(() => searchRef.current?.focus(), 100)
    }
  }, [showAddModal])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (speciesSearch.trim().length > 1) searchSpecies()
      else setSpeciesResults([])
    }, 300)
    return () => clearTimeout(timeout)
  }, [speciesSearch])

  async function searchSpecies() {
    setSpeciesLoading(true)
    const { data } = await supabase
      .from('species')
      .select('sp_no, species, common_name')
      .or(`species.ilike.%${speciesSearch}%,common_name.ilike.%${speciesSearch}%,species_genus.ilike.%${speciesSearch}%`)
      .order('species', { ascending: true })
      .limit(20)
    setSpeciesResults(data || [])
    setSpeciesLoading(false)
  }

  async function fetchTrees() {
    setLoading(true)
    const { data } = await supabase
      .from('collection')
      .select('*')
      .eq('in_collection', true).order('tree_number', { ascending: false })

    const rows = data || []
    const spNos = [...new Set(rows.map((t: any) => t.sp_no).filter(Boolean))]
    const variantSpNos = [...new Set(rows.map((t: any) => t.variant_sp_no).filter(Boolean))]
    let speciesMap: Record<number, any> = {}
    let variantMap: Record<number, any> = {}

    if (spNos.length > 0) {
      const { data: spData } = await supabase
        .from('species')
        .select('sp_no, species, common_name, species_genus, species_origin')
        .in('sp_no', spNos)
      ;(spData || []).forEach((s: any) => {
        speciesMap[s.sp_no] = s
      })
    }

    if (variantSpNos.length > 0) {
      const { data: varData } = await supabase
        .from('variants')
        .select('sp_no, variant_name, common_name, parent_sp_no')
        .in('sp_no', variantSpNos)
      ;(varData || []).forEach((v: any) => {
        variantMap[v.sp_no] = v
      })

      const parentSpNos = [...new Set(
        Object.values(variantMap).map((v: any) => v.parent_sp_no).filter(Boolean)
      )]
      const missingParents = parentSpNos.filter((id: any) => !speciesMap[id])
      if (missingParents.length > 0) {
        const { data: parentData } = await supabase
          .from('species')
          .select('sp_no, species, common_name, species_genus, species_origin')
          .in('sp_no', missingParents)
        ;(parentData || []).forEach((s: any) => { speciesMap[s.sp_no] = s })
      }
    }

    // Collect the "reference" sp_no (species itself, or the variant's parent) for every tree,
    // so we can pull frost data from regional_suitability in one batched query.
    const referenceSpNos = [...new Set(
      rows.map((t: any) => {
        if (t.variant_sp_no && variantMap[t.variant_sp_no]) {
          return variantMap[t.variant_sp_no].parent_sp_no
        }
        return t.sp_no
      }).filter(Boolean)
    )]

    let regionalMap: Record<number, any> = {}
    if (referenceSpNos.length > 0) {
      const { data: regionalData } = await supabase
        .from('regional_suitability')
        .select('sp_no, cold_risk, cold_suitability')
        .in('sp_no', referenceSpNos)
      ;(regionalData || []).forEach((r: any) => { regionalMap[r.sp_no] = r })
    }

    setTrees(rows.map((t: any) => {
      let speciesLabel = ''
      let genus = ''
      let origin = ''
      let referenceSpNo: number | null = null

      if (t.variant_sp_no && variantMap[t.variant_sp_no]) {
        const v = variantMap[t.variant_sp_no]
        speciesLabel = v.variant_name + (v.common_name && v.common_name !== 'Unknown' ? ' \u2014 ' + v.common_name : '')
        const parent = v.parent_sp_no ? speciesMap[v.parent_sp_no] : null
        genus = parent?.species_genus || ''
        origin = parent?.species_origin || ''
        referenceSpNo = v.parent_sp_no || null
      } else if (t.sp_no && speciesMap[t.sp_no]) {
        const s = speciesMap[t.sp_no]
        speciesLabel = s.species + (s.common_name && s.common_name !== 'Unknown' ? ' \u2014 ' + s.common_name : '')
        genus = s.species_genus || ''
        origin = s.species_origin || ''
        referenceSpNo = t.sp_no
      }

      const regional = referenceSpNo ? regionalMap[referenceSpNo] : null
      const frostProtectionRequired = !!(regional?.cold_risk || '').includes('Requires frost protection')

      return { ...t, speciesLabel, genus, origin, frostProtectionRequired }
    }))
    setLoading(false)
  }

  async function handleAddTree() {
    setAdding(true)
    const insertData: any = { display_name: selectedSpecies ? selectedSpecies.species : 'New Tree', in_collection: false }
    if (selectedSpecies) insertData.sp_no = selectedSpecies.sp_no
    const res = await fetch('/api/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insertData),
    })
    const data = await res.json()
    setAdding(false)
    if (!res.ok) { alert('Error: ' + data.error); return }
    window.location.href = `/collection/${data.collection_id}`
  }

  function isOverdue(dateStr: string | null) {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  const genusOptions = useMemo(() => {
    const set = new Set<string>()
    trees.forEach(t => { if (t.genus) set.add(t.genus) })
    return Array.from(set).sort()
  }, [trees])

  function isNative(origin: string) {
    return (origin || '').toLowerCase().includes('australia')
  }

  const filtered = trees.filter(t => {
    const matchesSearch = !search.trim() ||
      (t.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.tree_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.species || '').toLowerCase().includes(search.toLowerCase())

    const matchesGenus = !filterGenus || t.genus === filterGenus

    const matchesOrigin =
      filterOrigin === 'all' ||
      (filterOrigin === 'native' && isNative(t.origin)) ||
      (filterOrigin === 'exotic' && !isNative(t.origin))

    const matchesFrost = filterFrost === 'all' || (filterFrost === 'required' && t.frostProtectionRequired)

    return matchesSearch && matchesGenus && matchesOrigin && matchesFrost
  })

  const activeFilterCount = (filterGenus ? 1 : 0) + (filterOrigin !== 'all' ? 1 : 0) + (filterFrost !== 'all' ? 1 : 0)

  const healthColor: Record<string, string> = {
    'Excellent': '#16a34a', 'Good': '#65a30d', 'Stressed': '#d97706',
    'Recovering': '#9333ea', 'Critical': '#dc2626',
  }
  const statusColor: Record<string, string> = {
    'Developing': '#3b82f6', 'Refining': '#8b5cf6',
    'Show Ready': '#16a34a', 'Maintenance': '#6b7280',
  }

  return (
    <main style={{ maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>

      {/* Add Species Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '24px',
            width: '100%', maxWidth: '480px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Add to Collection</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}>&#x2715;</button>
            </div>

            {!selectedSpecies ? (
              <>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>Search for a species to add:</p>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search species or common name..."
                  value={speciesSearch}
                  onChange={e => setSpeciesSearch(e.target.value)}
                  style={{
                    width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px',
                    padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '8px'
                  }}
                />
                {speciesLoading && <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '12px' }}>Searching...</p>}
                {!speciesLoading && speciesResults.length > 0 && (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                    {speciesResults.map((s, i) => (
                      <button
                        key={s.sp_no}
                        onClick={() => setSelectedSpecies(s)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '10px 14px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderBottom: i < speciesResults.length - 1 ? '1px solid #f1f5f9' : 'none',
                        }}
                      >
                        <p style={{ fontSize: '14px', fontStyle: 'italic', fontWeight: '500', color: '#111827', margin: '0 0 2px' }}>{s.species}</p>
                        {s.common_name && s.common_name !== 'Unknown' && (
                          <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{s.common_name}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {!speciesLoading && speciesSearch.trim().length > 1 && speciesResults.length === 0 && (
                  <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '12px' }}>No species found</p>
                )}
                <button
                  onClick={() => { setSelectedSpecies(null); handleAddTree() }}
                  style={{ marginTop: '16px', width: '100%', padding: '10px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}
                >
                  Skip species &mdash; add blank tree
                </button>
              </>
            ) : (
              <>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px' }}>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Selected species:</p>
                  <p style={{ fontSize: '16px', fontStyle: 'italic', fontWeight: '600', color: '#111827', margin: '0 0 2px' }}>{selectedSpecies.species}</p>
                  {selectedSpecies.common_name && selectedSpecies.common_name !== 'Unknown' && (
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{selectedSpecies.common_name}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setSelectedSpecies(null)}
                    style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', color: '#6b7280', cursor: 'pointer' }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleAddTree}
                    disabled={adding}
                    style={{ flex: 2, padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    {adding ? 'Adding...' : 'Add to Collection'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <a href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>&larr; Admin Home</a>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '4px 0 0' }}>My Bonsai Collection</h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
        >
          + Add Tree
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          type="text"
          placeholder="Search trees..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', fontSize: '15px', boxSizing: 'border-box' }}
        />
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            border: '1px solid ' + (activeFilterCount > 0 ? '#16a34a' : '#e2e8f0'),
            background: activeFilterCount > 0 ? '#f0fdf4' : '#fff',
            color: activeFilterCount > 0 ? '#16a34a' : '#374151',
            borderRadius: '8px', padding: '0 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap'
          }}
        >
          &#9881; Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {showFilters && (
        <div style={{
          background: '#f9fafb', border: '1px solid #e2e8f0', borderRadius: '10px',
          padding: '16px', marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '20px'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>Genus</label>
            <select
              value={filterGenus}
              onChange={e => setFilterGenus(e.target.value)}
              style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', minWidth: '160px' }}
            >
              <option value="">All genera</option>
              {genusOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>Origin</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['all', 'native', 'exotic'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setFilterOrigin(opt)}
                  style={{
                    border: '1px solid ' + (filterOrigin === opt ? '#16a34a' : '#e2e8f0'),
                    background: filterOrigin === opt ? '#16a34a' : '#fff',
                    color: filterOrigin === opt ? '#fff' : '#374151',
                    borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', textTransform: 'capitalize'
                  }}
                >
                  {opt === 'all' ? 'All' : opt === 'native' ? 'AU Native' : 'Exotic'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>Frost Protection</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['all', 'required'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => setFilterFrost(opt)}
                  style={{
                    border: '1px solid ' + (filterFrost === opt ? '#16a34a' : '#e2e8f0'),
                    background: filterFrost === opt ? '#16a34a' : '#fff',
                    color: filterFrost === opt ? '#fff' : '#374151',
                    borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', textTransform: 'capitalize'
                  }}
                >
                  {opt === 'all' ? 'All' : 'Required'}
                </button>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setFilterGenus(''); setFilterOrigin('all'); setFilterFrost('all') }}
              style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: '#dc2626', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>{filtered.length} tree{filtered.length !== 1 ? 's' : ''}</p>

      {loading && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>Loading...</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
      {!loading && filtered.map(t => {
        const overdue = isOverdue(t.next_repot_due) || isOverdue(t.next_fertilise_due) || isOverdue(t.due_prune_date) || isOverdue(t.date_check_wire)
        return (
          <a key={t.collection_id} href={`/collection/${t.collection_id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
              {t.image_url ? (
                <img src={t.image_url} alt={t.display_name} style={{ width: '90px', height: '90px', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '90px', height: '90px', background: '#f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>&#127807;</div>
              )}
              <div style={{ flex: 1, padding: '10px 12px 10px 0', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontWeight: '700', fontSize: '16px' }}>{t.display_name}</span>
                    {t.tree_number && <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '8px' }}>#{t.tree_number}</span>}
                  </div>
                  {overdue && <span style={{ fontSize: '11px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '2px 6px', flexShrink: 0 }}>&#9888; Overdue</span>}
                </div>
                {t.tree_name && <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0', fontStyle: 'italic' }}>"{t.tree_name}"</p>}
                {t.speciesLabel && <p style={{ fontSize: '13px', color: '#374151', margin: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.speciesLabel}</p>}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {t.status && <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: (statusColor[t.status] || '#6b7280') + '22', color: statusColor[t.status] || '#6b7280' }}>{t.status}</span>}
                  {t.health_status && <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: (healthColor[t.health_status] || '#6b7280') + '22', color: healthColor[t.health_status] || '#6b7280' }}>{t.health_status}</span>}
                  {t.frostProtectionRequired && <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: '#eff6ff', color: '#2563eb' }}>&#10052; Frost Protection</span>}
                  {t.origin_tubestock_tag && <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: '#f0fdf4', color: '#16a34a' }}>&#127793; {t.origin_tubestock_tag}</span>}
                  {t.is_favourite && <span style={{ fontSize: '12px' }}>&#10084;</span>}
                </div>
              </div>
            </div>
         </a>
        )
      })}
      </div>
    </main>
  )
}