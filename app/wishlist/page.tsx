'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const SIZE_OPTIONS = [
  'Tubestock',
  'Nursery Stock (Small)',
  'Nursery Stock (Medium)',
  'Nursery Stock (Large)',
  'Bonsai',
]

const STATUS_OPTIONS = ['watching', 'purchased', 'passed']

const statusColor: Record<string, string> = {
  watching: '#2563eb',
  purchased: '#16a34a',
  passed: '#6b7280',
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px',
  padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '3px' }

type Supplier = { id: number; name: string; location: string | null; notes: string | null }
type SpeciesRow = { sp_no: number; species: string; common_name: string | null }
type WishlistItem = {
  id: number; supplier_id: number; sp_no: number; size_category: string
  price: number | null; notes: string | null; date_seen: string; status: string
}

export default function WishlistPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null)
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierLocation, setNewSupplierLocation] = useState('')
  const [newSupplierNotes, setNewSupplierNotes] = useState('')
  const [savingSupplier, setSavingSupplier] = useState(false)

  // Species search for the "add plants seen" flow -- searches by species/
  // common name directly (debounced, queried live) rather than genus-first,
  // since genus-first is an extra unnecessary tap in a nursery aisle.
  const [addQuery, setAddQuery] = useState('')
  const [addResults, setAddResults] = useState<SpeciesRow[]>([])
  const [searchingAdd, setSearchingAdd] = useState(false)
  // Ticked species staged for this supplier visit, keyed by sp_no so they
  // survive the search query changing (searching for a second species
  // shouldn't lose the first one you already ticked).
  const [staged, setStaged] = useState<Record<number, { sp: SpeciesRow; size: string; price: string; notes: string }>>({})
  const [addingToWishlist, setAddingToWishlist] = useState(false)

  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [speciesMap, setSpeciesMap] = useState<Record<number, SpeciesRow>>({})
  const [filterSupplierId, setFilterSupplierId] = useState<number | 'all'>('all')
  const [viewMode, setViewMode] = useState<'supplier' | 'species'>('supplier')
  const [speciesSearch, setSpeciesSearch] = useState('')

  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editSize, setEditSize] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState('watching')
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => { fetchAll() }, [])

  // Debounced live search -- queries the DB directly per keystroke (after a
  // short pause) rather than filtering a client-side list, so this never
  // hits the 1000-row cap regardless of how many species match.
  useEffect(() => {
    const q = addQuery.trim()
    if (q.length < 2) { setAddResults([]); return }
    setSearchingAdd(true)
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('species')
        .select('sp_no, species, common_name')
        .or(`species.ilike.%${q}%,common_name.ilike.%${q}%`)
        .order('species', { ascending: true })
        .limit(30)
      setAddResults((data as SpeciesRow[]) || [])
      setSearchingAdd(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [addQuery])

  async function fetchAll() {
    setLoading(true)
    const suppliersRes = await fetch('/api/plant-suppliers')
    const suppliersData = suppliersRes.ok ? await suppliersRes.json() : []
    setSuppliers(suppliersData || [])
    if (!selectedSupplierId && suppliersData && suppliersData.length > 0) {
      setSelectedSupplierId(suppliersData[0].id)
    }

    // No longer fetching the full genus list here -- the add-plants flow
    // now searches species directly (see the debounced addQuery effect
    // above), which queries the DB per keystroke instead of needing a
    // client-side list of everything up front.

    const wishlistRes = await fetch('/api/wishlist-items')
    const wishlistData = wishlistRes.ok ? await wishlistRes.json() : []
    setWishlist(wishlistData || [])

    const spNosNeeded = Array.from(new Set((wishlistData || []).map((w: any) => w.sp_no)))
    if (spNosNeeded.length > 0) {
      const { data: spData } = await supabase.from('species').select('sp_no, species, common_name').in('sp_no', spNosNeeded)
      const map: Record<number, SpeciesRow> = {}
      ;(spData || []).forEach((s: any) => { map[s.sp_no] = s })
      setSpeciesMap(prev => ({ ...prev, ...map }))
    }

    setLoading(false)
  }

  async function handleAddSupplier() {
    if (!newSupplierName.trim()) { alert('Name is required.'); return }
    setSavingSupplier(true)
    const res = await fetch('/api/plant-suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newSupplierName.trim(),
        location: newSupplierLocation.trim() || null,
        notes: newSupplierNotes.trim() || null,
      }),
    })
    const data = await res.json()
    setSavingSupplier(false)
    if (!res.ok) { alert('Error: ' + data.error); return }
    setNewSupplierName('')
    setNewSupplierLocation('')
    setNewSupplierNotes('')
    setAddingSupplier(false)
    await fetchAll()
    if (data && data[0]) setSelectedSupplierId(data[0].id)
  }

  function toggleStaged(sp: SpeciesRow) {
    setStaged(prev => {
      const next = { ...prev }
      if (next[sp.sp_no]) {
        delete next[sp.sp_no]
      } else {
        next[sp.sp_no] = { sp, size: SIZE_OPTIONS[0], price: '', notes: '' }
      }
      return next
    })
  }

  function updateStaged(spNo: number, field: 'size' | 'price' | 'notes', value: string) {
    setStaged(prev => prev[spNo] ? { ...prev, [spNo]: { ...prev[spNo], [field]: value } } : prev)
  }

  function removeStaged(spNo: number) {
    setStaged(prev => {
      const next = { ...prev }
      delete next[spNo]
      return next
    })
  }

  async function handleAddToWishlist() {
    const stagedList = Object.values(staged)
    if (!selectedSupplierId) { alert('Select or add a supplier first.'); return }
    if (stagedList.length === 0) { alert('Tick at least one species.'); return }
    setAddingToWishlist(true)
    const items = stagedList.map(s => ({
      supplier_id: selectedSupplierId,
      sp_no: s.sp.sp_no,
      size_category: s.size || SIZE_OPTIONS[0],
      price: s.price ? parseFloat(s.price) : null,
      notes: s.notes || null,
    }))
    const res = await fetch('/api/wishlist-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    const data = await res.json()
    setAddingToWishlist(false)
    if (!res.ok) { alert('Error: ' + data.error); return }
    setStaged({})
    setAddQuery('')
    setAddResults([])
    fetchAll()
  }

  function openEditor(item: WishlistItem) {
    setEditingItemId(item.id)
    setEditSize(item.size_category)
    setEditPrice(item.price !== null ? String(item.price) : '')
    setEditNotes(item.notes || '')
    setEditStatus(item.status)
  }

  async function handleSaveEdit(id: number) {
    setSavingEdit(true)
    const res = await fetch('/api/wishlist-items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        size_category: editSize,
        price: editPrice ? parseFloat(editPrice) : null,
        notes: editNotes || null,
        status: editStatus,
      }),
    })
    const data = await res.json()
    setSavingEdit(false)
    if (!res.ok) { alert('Error: ' + data.error); return }
    setEditingItemId(null)
    fetchAll()
  }

  async function handleDeleteItem(id: number) {
    if (!confirm('Remove this wishlist entry?')) return
    const res = await fetch(`/api/wishlist-items?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { const data = await res.json(); alert('Error: ' + data.error); return }
    fetchAll()
  }

  async function handleDeleteSupplier(id: number, name: string) {
    if (!confirm(`Remove supplier "${name}"? All wishlist entries for this supplier will also be deleted.`)) return
    const res = await fetch(`/api/plant-suppliers?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { const data = await res.json(); alert('Error deleting supplier'); return }
    if (selectedSupplierId === id) setSelectedSupplierId(null)
    if (filterSupplierId === id) setFilterSupplierId('all')
    fetchAll()
  }

  const visibleWishlist = wishlist.filter(w => filterSupplierId === 'all' || w.supplier_id === filterSupplierId)
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]))

  // Species-comparison view: group every wishlist entry by sp_no regardless
  // of supplier, so the same species can be compared across suppliers on
  // price/size/notes at a glance. Cheapest entry per species is flagged.
  const searchLower = speciesSearch.trim().toLowerCase()
  const matchesSearch = (spNo: number) => {
    if (!searchLower) return true
    const sp = speciesMap[spNo]
    if (!sp) return false
    return sp.species.toLowerCase().includes(searchLower) || (sp.common_name || '').toLowerCase().includes(searchLower)
  }
  const groupedBySpecies = new Map<number, WishlistItem[]>()
  wishlist.filter(w => matchesSearch(w.sp_no)).forEach(w => {
    if (!groupedBySpecies.has(w.sp_no)) groupedBySpecies.set(w.sp_no, [])
    groupedBySpecies.get(w.sp_no)!.push(w)
  })
  const speciesGroups = Array.from(groupedBySpecies.entries())
    .map(([spNo, items]) => ({
      spNo,
      sp: speciesMap[spNo],
      items: items.slice().sort((a, b) => {
        if (a.price === null) return 1
        if (b.price === null) return -1
        return a.price - b.price
      }),
    }))
    .sort((a, b) => (a.sp?.species || '').localeCompare(b.sp?.species || ''))

  function renderItemCard(item: WishlistItem, opts: { showSpecies: boolean; showSupplier: boolean; isCheapest?: boolean }) {
    const sp = speciesMap[item.sp_no]
    const supplier = supplierMap[item.supplier_id]
    return (
      <div key={item.id} style={{ background: '#fff', border: opts.isCheapest ? '1.5px solid #16a34a' : '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px' }}>
        {editingItemId === item.id ? (
          <div>
            <p style={{ fontWeight: 600, fontSize: '14px', margin: '0 0 8px' }}>{sp ? sp.species : `sp_no ${item.sp_no}`}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Size</label>
                <select value={editSize} onChange={e => setEditSize(e.target.value)} style={inputStyle}>
                  {SIZE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Price ($)</label>
                <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={inputStyle}>
                  {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button onClick={() => setEditingItemId(null)} style={{ flex: 1, padding: '7px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleSaveEdit(item.id)} disabled={savingEdit} style={{ flex: 1, padding: '7px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {savingEdit ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                {opts.showSpecies && (
                  <>
                    <p style={{ fontWeight: 600, fontSize: '14px', margin: 0 }}>{sp ? sp.species : `sp_no ${item.sp_no}`}</p>
                    {sp?.common_name && sp.common_name !== 'Unknown' && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{sp.common_name}</p>}
                  </>
                )}
                {opts.showSupplier && !opts.showSpecies && (
                  <p style={{ fontWeight: 600, fontSize: '13px', margin: 0 }}>{supplier ? supplier.name : 'Unknown supplier'}</p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {opts.isCheapest && (
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: '#16a34a22', color: '#16a34a' }}>
                    BEST PRICE
                  </span>
                )}
                <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: (statusColor[item.status] || '#6b7280') + '22', color: statusColor[item.status] || '#6b7280', textTransform: 'capitalize' }}>
                  {item.status}
                </span>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#374151', margin: '6px 0 0' }}>
              {opts.showSupplier && (supplier ? supplier.name : 'Unknown supplier')}{opts.showSupplier ? ' \u00b7 ' : ''}{item.size_category}{item.price !== null ? ` \u00b7 $${item.price}` : ''} &middot; seen {item.date_seen}
            </p>
            {item.notes && <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0', fontStyle: 'italic' }}>{item.notes}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => openEditor(item)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', cursor: 'pointer', padding: 0 }}>Edit</button>
              <button onClick={() => handleDeleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer', padding: 0 }}>Delete</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <main style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}><p style={{ color: '#9ca3af' }}>Loading...</p></main>

  return (
    <main style={{ maxWidth: '900px', width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>
      <a href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>&larr; Home</a>
      <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '8px 0 4px' }}>Wishlist</h1>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px' }}>Track plants you've seen at nurseries — by supplier, species, size, and price.</p>

      {/* SUPPLIER SELECT / ADD */}
      <div style={{ background: '#f9fafb', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 10px' }}>Supplier / Location</h2>

        {suppliers.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {suppliers.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => setSelectedSupplierId(s.id)}
                  style={{
                    fontSize: '12px', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                    border: selectedSupplierId === s.id ? '1.5px solid #16a34a' : '1px solid #e2e8f0',
                    background: selectedSupplierId === s.id ? '#16a34a22' : '#fff',
                    color: selectedSupplierId === s.id ? '#16a34a' : '#374151', fontWeight: selectedSupplierId === s.id ? 600 : 400,
                  }}>
                  {s.name}{s.location ? ` (${s.location})` : ''}
                </button>
                <button onClick={() => handleDeleteSupplier(s.id, s.name)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer', padding: 0 }}>&times;</button>
              </div>
            ))}
          </div>
        )}

        {addingSupplier ? (
          <div style={{ marginTop: '6px' }}>
            <label style={labelStyle}>Name</label>
            <input type="text" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} style={{ ...inputStyle, marginBottom: '6px' }} placeholder="e.g. Bywong Nursery" />
            <label style={labelStyle}>Location</label>
            <input type="text" value={newSupplierLocation} onChange={e => setNewSupplierLocation(e.target.value)} style={{ ...inputStyle, marginBottom: '6px' }} placeholder="e.g. Bungendore, NSW" />
            <label style={labelStyle}>Notes</label>
            <textarea value={newSupplierNotes} onChange={e => setNewSupplierNotes(e.target.value)} rows={2} style={{ ...inputStyle, marginBottom: '8px' }} />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setAddingSupplier(false)} style={{ flex: 1, padding: '7px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAddSupplier} disabled={savingSupplier} style={{ flex: 1, padding: '7px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {savingSupplier ? 'Saving...' : 'Add Supplier'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingSupplier(true)} style={{ fontSize: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer' }}>
            + Add Supplier
          </button>
        )}
      </div>

      {/* SPECIES SEARCH -> STAGED SELECTION */}
      <div style={{ background: '#f9fafb', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 10px' }}>Add plants seen</h2>
        {!selectedSupplierId && <p style={{ fontSize: '12px', color: '#dc2626', margin: '0 0 8px' }}>Select or add a supplier above first.</p>}

        <label style={labelStyle}>Species or common name</label>
        <input
          type="text"
          value={addQuery}
          onChange={e => setAddQuery(e.target.value)}
          placeholder="Start typing e.g. Leptospermum, or a common name..."
          style={{ ...inputStyle, marginBottom: '10px' }}
        />

        {searchingAdd && <p style={{ fontSize: '12px', color: '#9ca3af' }}>Searching...</p>}

        {!searchingAdd && addQuery.trim().length >= 2 && addResults.length === 0 && (
          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>No species match "{addQuery}".</p>
        )}

        {!searchingAdd && addQuery.trim().length > 0 && addQuery.trim().length < 2 && (
          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>Keep typing (2+ letters)...</p>
        )}

        {addResults.length > 0 && (
          <div style={{ marginBottom: '14px', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '220px', overflowY: 'auto', background: '#fff' }}>
            {addResults.map(sp => (
              <label key={sp.sp_no} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', padding: '9px 12px', borderBottom: '1px solid #f1f5f9' }}>
                <input type="checkbox" checked={!!staged[sp.sp_no]} onChange={() => toggleStaged(sp)} style={{ width: '15px', height: '15px', flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{sp.species}</span>
                {sp.common_name && sp.common_name !== 'Unknown' && <span style={{ color: '#6b7280' }}>&mdash; {sp.common_name}</span>}
              </label>
            ))}
          </div>
        )}

        {Object.keys(staged).length > 0 && (
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>
              Ready to add ({Object.keys(staged).length}):
            </p>
            {Object.values(staged).map(({ sp, size, price, notes }) => (
              <div key={sp.sp_no} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '13px', margin: 0 }}>{sp.species}</p>
                    {sp.common_name && sp.common_name !== 'Unknown' && <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>{sp.common_name}</p>}
                  </div>
                  <button onClick={() => removeStaged(sp.sp_no)} type="button" style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer', padding: 0 }}>Remove</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <div>
                    <label style={labelStyle}>Size</label>
                    <select value={size} onChange={e => updateStaged(sp.sp_no, 'size', e.target.value)} style={inputStyle}>
                      {SIZE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Price ($)</label>
                    <input type="number" value={price} onChange={e => updateStaged(sp.sp_no, 'price', e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Notes</label>
                    <textarea value={notes} onChange={e => updateStaged(sp.sp_no, 'notes', e.target.value)} rows={2} style={inputStyle} />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={handleAddToWishlist}
              disabled={addingToWishlist || !selectedSupplierId}
              style={{ marginTop: '4px', width: '100%', padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
              {addingToWishlist ? 'Adding...' : `Add ${Object.keys(staged).length} to Wishlist`}
            </button>
          </div>
        )}
      </div>

      {/* WISHLIST VIEW */}
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <button
            onClick={() => setViewMode('supplier')}
            style={{
              flex: 1, fontSize: '13px', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600,
              border: viewMode === 'supplier' ? '1.5px solid #16a34a' : '1px solid #e2e8f0',
              background: viewMode === 'supplier' ? '#16a34a22' : '#fff',
              color: viewMode === 'supplier' ? '#16a34a' : '#6b7280',
            }}>
            By Supplier
          </button>
          <button
            onClick={() => setViewMode('species')}
            style={{
              flex: 1, fontSize: '13px', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600,
              border: viewMode === 'species' ? '1.5px solid #16a34a' : '1px solid #e2e8f0',
              background: viewMode === 'species' ? '#16a34a22' : '#fff',
              color: viewMode === 'species' ? '#16a34a' : '#6b7280',
            }}>
            By Species (Compare)
          </button>
        </div>

        {viewMode === 'supplier' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Wishlist ({visibleWishlist.length})</h2>
              <select value={filterSupplierId} onChange={e => setFilterSupplierId(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))} style={{ ...inputStyle, width: 'auto' }}>
                <option value="all">All suppliers</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {visibleWishlist.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px' }}>Nothing on the wishlist yet.</p>}

            {visibleWishlist.map(item => renderItemCard(item, { showSpecies: true, showSupplier: filterSupplierId === 'all' }))}
          </>
        ) : (
          <>
            <div style={{ marginBottom: '10px' }}>
              <input
                type="text"
                value={speciesSearch}
                onChange={e => setSpeciesSearch(e.target.value)}
                placeholder="Search species or common name..."
                style={inputStyle}
              />
            </div>

            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px' }}>{speciesGroups.length} species tracked &middot; sorted cheapest-first within each</p>

            {speciesGroups.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px' }}>Nothing matches.</p>}

            {speciesGroups.map(group => (
              <div key={group.spNo} style={{ marginBottom: '18px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 6px' }}>
                  {group.sp ? group.sp.species : `sp_no ${group.spNo}`}
                  {group.sp?.common_name && group.sp.common_name !== 'Unknown' && (
                    <span style={{ fontWeight: 400, color: '#6b7280' }}> &mdash; {group.sp.common_name}</span>
                  )}
                  <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '12px' }}> ({group.items.length} supplier{group.items.length === 1 ? '' : 's'})</span>
                </h3>
                {group.items.map((item, idx) => renderItemCard(item, { showSpecies: false, showSupplier: true, isCheapest: idx === 0 && item.price !== null && group.items.length > 1 }))}
              </div>
            ))}
          </>
        )}
      </div>
    </main>
  )
}
