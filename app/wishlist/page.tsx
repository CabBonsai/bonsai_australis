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

  const [genera, setGenera] = useState<string[]>([])
  const [selectedGenus, setSelectedGenus] = useState('')
  const [genusQuery, setGenusQuery] = useState('')
  const [genusDropdownOpen, setGenusDropdownOpen] = useState(false)
  const [speciesInGenus, setSpeciesInGenus] = useState<SpeciesRow[]>([])
  const [loadingSpecies, setLoadingSpecies] = useState(false)

  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [rowSize, setRowSize] = useState<Record<number, string>>({})
  const [rowPrice, setRowPrice] = useState<Record<number, string>>({})
  const [rowNotes, setRowNotes] = useState<Record<number, string>>({})
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

  async function fetchAll() {
    setLoading(true)
    const suppliersRes = await fetch('/api/plant-suppliers')
    const suppliersData = suppliersRes.ok ? await suppliersRes.json() : []
    setSuppliers(suppliersData || [])
    if (!selectedSupplierId && suppliersData && suppliersData.length > 0) {
      setSelectedSupplierId(suppliersData[0].id)
    }

    // Supabase caps a single select at 1000 rows. With ~8,450 species rows
    // (Acacia alone is ~1,483), a plain select() silently truncated this to
    // genera starting around "Ac..." -- anything alphabetically later
    // (including Leptospermum) never made it into the dropdown. Paginate
    // through the full table instead.
    const allGenusValues: string[] = []
    let genusFrom = 0
    const PAGE_SIZE = 1000
    while (true) {
      const { data: page } = await supabase
        .from('species')
        .select('species_genus')
        .not('species_genus', 'is', null)
        .range(genusFrom, genusFrom + PAGE_SIZE - 1)
      if (!page || page.length === 0) break
      page.forEach((row: any) => allGenusValues.push(row.species_genus))
      if (page.length < PAGE_SIZE) break
      genusFrom += PAGE_SIZE
    }
    const uniqueGenera = Array.from(new Set(allGenusValues)).sort((a, b) => a.localeCompare(b))
    setGenera(uniqueGenera)

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

  async function selectGenus(genus: string) {
    setSelectedGenus(genus)
    setGenusQuery(genus)
    setGenusDropdownOpen(false)
    setChecked(new Set())
    setRowSize({})
    setRowPrice({})
    setRowNotes({})
    if (!genus) { setSpeciesInGenus([]); return }
    setLoadingSpecies(true)
    // Same 1000-row cap risk as the genus list -- Acacia alone has ~1,483
    // species, so a plain select() would silently drop ~480 of them from
    // the ticklist. Paginate here too.
    const allRows: SpeciesRow[] = []
    let spFrom = 0
    const SP_PAGE_SIZE = 1000
    while (true) {
      const { data: page } = await supabase
        .from('species')
        .select('sp_no, species, common_name')
        .eq('species_genus', genus)
        .order('species', { ascending: true })
        .range(spFrom, spFrom + SP_PAGE_SIZE - 1)
      if (!page || page.length === 0) break
      allRows.push(...(page as SpeciesRow[]))
      if (page.length < SP_PAGE_SIZE) break
      spFrom += SP_PAGE_SIZE
    }
    setSpeciesInGenus(allRows)
    setLoadingSpecies(false)
    // Merge into the species map so newly-ticked items display correctly
    // in the wishlist below without a refetch.
    const map: Record<number, SpeciesRow> = {}
    allRows.forEach((s: any) => { map[s.sp_no] = s })
    setSpeciesMap(prev => ({ ...prev, ...map }))
  }

  function clearGenus() {
    setSelectedGenus('')
    setGenusQuery('')
    setSpeciesInGenus([])
    setChecked(new Set())
  }

  // Filtered live as the person types -- capped so a broad query (or an
  // empty one) doesn't try to render all 1,200+ genera into the DOM at once.
  const genusMatches = genera
    .filter(g => g.toLowerCase().includes(genusQuery.trim().toLowerCase()))
    .slice(0, 40)

  function toggleChecked(spNo: number) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(spNo)) {
        next.delete(spNo)
      } else {
        next.add(spNo)
        if (!rowSize[spNo]) setRowSize(r => ({ ...r, [spNo]: SIZE_OPTIONS[0] }))
      }
      return next
    })
  }

  async function handleAddToWishlist() {
    if (!selectedSupplierId) { alert('Select or add a supplier first.'); return }
    if (checked.size === 0) { alert('Tick at least one species.'); return }
    setAddingToWishlist(true)
    const items = Array.from(checked).map(spNo => ({
      supplier_id: selectedSupplierId,
      sp_no: spNo,
      size_category: rowSize[spNo] || SIZE_OPTIONS[0],
      price: rowPrice[spNo] ? parseFloat(rowPrice[spNo]) : null,
      notes: rowNotes[spNo] || null,
    }))
    const res = await fetch('/api/wishlist-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    const data = await res.json()
    setAddingToWishlist(false)
    if (!res.ok) { alert('Error: ' + data.error); return }
    setChecked(new Set())
    setRowSize({})
    setRowPrice({})
    setRowNotes({})
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

      {/* GENUS -> SPECIES TICKLIST */}
      <div style={{ background: '#f9fafb', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 10px' }}>Add plants seen</h2>
        {!selectedSupplierId && <p style={{ fontSize: '12px', color: '#dc2626', margin: '0 0 8px' }}>Select or add a supplier above first.</p>}

        <label style={labelStyle}>Genus</label>
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={genusQuery}
              onChange={e => { setGenusQuery(e.target.value); setSelectedGenus(''); setGenusDropdownOpen(true) }}
              onFocus={() => setGenusDropdownOpen(true)}
              onBlur={() => setTimeout(() => setGenusDropdownOpen(false), 150)}
              placeholder="Type to search genus (e.g. Acacia)..."
              style={inputStyle}
            />
            {(genusQuery || selectedGenus) && (
              <button onClick={clearGenus} type="button" style={{ padding: '0 12px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#6b7280', fontSize: '13px', cursor: 'pointer' }}>
                &times;
              </button>
            )}
          </div>

          {genusDropdownOpen && genusQuery.trim() !== '' && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '4px',
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
              maxHeight: '260px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}>
              {genusMatches.length === 0 && (
                <p style={{ fontSize: '12px', color: '#9ca3af', padding: '10px' }}>No genus matches "{genusQuery}".</p>
              )}
              {genusMatches.map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => selectGenus(g)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
                    background: g === selectedGenus ? '#16a34a22' : 'none', border: 'none',
                    borderBottom: '1px solid #f1f5f9', fontSize: '13px', color: '#374151', cursor: 'pointer',
                  }}
                >
                  {g}
                </button>
              ))}
              {genera.filter(g => g.toLowerCase().includes(genusQuery.trim().toLowerCase())).length > 40 && (
                <p style={{ fontSize: '11px', color: '#9ca3af', padding: '8px 12px', margin: 0 }}>
                  More than 40 matches — keep typing to narrow it down.
                </p>
              )}
            </div>
          )}

          {selectedGenus && !genusDropdownOpen && (
            <p style={{ fontSize: '12px', color: '#16a34a', margin: '4px 0 0', fontWeight: 600 }}>Selected: {selectedGenus}</p>
          )}
        </div>

        {loadingSpecies && <p style={{ fontSize: '12px', color: '#9ca3af' }}>Loading species...</p>}

        {!loadingSpecies && speciesInGenus.length > 0 && (
          <div>
            {speciesInGenus.map(sp => (
              <div key={sp.sp_no} style={{ borderBottom: '1px solid #eef1f5', padding: '8px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input type="checkbox" checked={checked.has(sp.sp_no)} onChange={() => toggleChecked(sp.sp_no)} style={{ width: '15px', height: '15px' }} />
                  <span style={{ fontWeight: 600 }}>{sp.species}</span>
                  {sp.common_name && sp.common_name !== 'Unknown' && <span style={{ color: '#6b7280' }}>&mdash; {sp.common_name}</span>}
                </label>

                {checked.has(sp.sp_no) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px', paddingLeft: '23px' }}>
                    <div>
                      <label style={labelStyle}>Size</label>
                      <select value={rowSize[sp.sp_no] || SIZE_OPTIONS[0]} onChange={e => setRowSize(r => ({ ...r, [sp.sp_no]: e.target.value }))} style={inputStyle}>
                        {SIZE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Price ($)</label>
                      <input type="number" value={rowPrice[sp.sp_no] || ''} onChange={e => setRowPrice(r => ({ ...r, [sp.sp_no]: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Notes</label>
                      <textarea value={rowNotes[sp.sp_no] || ''} onChange={e => setRowNotes(r => ({ ...r, [sp.sp_no]: e.target.value }))} rows={2} style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={handleAddToWishlist}
              disabled={addingToWishlist || checked.size === 0 || !selectedSupplierId}
              style={{ marginTop: '12px', width: '100%', padding: '10px', background: checked.size === 0 ? '#9ca3af' : '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: checked.size === 0 ? 'default' : 'pointer' }}>
              {addingToWishlist ? 'Adding...' : `Add ${checked.size || ''} to Wishlist`}
            </button>
          </div>
        )}

        {!loadingSpecies && selectedGenus && speciesInGenus.length === 0 && (
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>No species found for this genus.</p>
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
