'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const inputClass = "w-full border rounded px-4 py-3 text-base min-h-[48px]"

type Tubestock = {
  id: number
  sp_no: number | null
  species_name_text: string | null
  quantity: number
  source: string | null
  acquisition_date: string | null
  health_notes: string | null
  growing_on_notes: string | null
  target_criteria: string | null
  status: 'growing_on' | 'promoted' | 'culled'
  promoted_to_collection_id: string | null
  promoted_date: string | null
  culled_date: string | null
  culled_reason: string | null
}

type SpeciesInfo = {
  species: string
  common_name: string | null
}

const statusStyles: Record<string, string> = {
  growing_on: 'bg-blue-100 text-blue-700',
  promoted: 'bg-green-100 text-green-700',
  culled: 'bg-gray-200 text-gray-500',
}

export default function TubestockAdmin() {
  const [rows, setRows] = useState<Tubestock[]>([])
  const [speciesMap, setSpeciesMap] = useState<Record<number, SpeciesInfo>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setFetchError(null)

    const { data: stockData, error: stockError } = await supabase
      .from('tubestock')
      .select('*')
      .order('created_at', { ascending: false })

    if (stockError) {
      setFetchError(stockError.message)
      setLoading(false)
      return
    }

    const tubestockRows = stockData || []
    setRows(tubestockRows)

    const spNos = [...new Set(tubestockRows.map(r => r.sp_no).filter(Boolean))] as number[]
    if (spNos.length > 0) {
      const { data: spData } = await supabase.from('species').select('sp_no, species, common_name').in('sp_no', spNos)
      const map: Record<number, SpeciesInfo> = {}
      for (const s of spData || []) map[s.sp_no] = { species: s.species, common_name: s.common_name }
      setSpeciesMap(map)
    }

    setLoading(false)
  }

  function label(row: Tubestock) {
    if (row.sp_no && speciesMap[row.sp_no]) return speciesMap[row.sp_no].species
    return row.species_name_text || 'Unlinked species'
  }

  const filtered = rows.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const name = label(r)
    const common = (r.sp_no && speciesMap[r.sp_no]?.common_name) || ''
    return (
      name.toLowerCase().includes(q) ||
      common.toLowerCase().includes(q) ||
      (r.source || '').toLowerCase().includes(q)
    )
  })

  if (fetchError) return <main className="max-w-2xl mx-auto p-4"><p style={{ color: 'red' }}>Error: {fetchError}</p></main>
  if (loading) return <main className="max-w-2xl mx-auto p-4"><p>Loading...</p></main>

  if (editingId !== null) {
    const row = rows.find(r => r.id === editingId)
    if (!row) return null
    return (
      <TubestockEditor
        row={row}
        speciesInfo={row.sp_no ? speciesMap[row.sp_no] : undefined}
        displayLabel={label(row)}
        onDone={() => { setEditingId(null); fetchAll() }}
      />
    )
  }

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Tubestock</h1>
      <input
        type="text"
        placeholder="Search tubestock..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className={inputClass + " mb-4"}
      />
      <div className="space-y-2">
        {filtered.map(row => {
          const info = row.sp_no ? speciesMap[row.sp_no] : undefined
          return (
            <button
              key={row.id}
              onClick={() => setEditingId(row.id)}
              className="w-full flex items-center gap-3 border rounded-lg p-3 text-left"
            >
              <div className="flex-1">
                <p className="font-medium text-sm">{label(row)}</p>
                {info?.common_name && <p className="text-xs text-gray-500">{info.common_name}</p>}
                <p className="text-xs text-gray-400">
                  Qty {row.quantity}{row.source ? ` \u00b7 ${row.source}` : ''}{row.acquisition_date ? ` \u00b7 ${row.acquisition_date}` : ''}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${statusStyles[row.status] || 'bg-gray-100 text-gray-600'}`}>
                {row.status.replace('_', ' ')}
              </span>
            </button>
          )
        })}
        {filtered.length === 0 && <p className="text-sm text-gray-400">No tubestock match.</p>}
      </div>
    </main>
  )
}

function TubestockEditor({ row, speciesInfo, displayLabel, onDone }: {
  row: Tubestock, speciesInfo: SpeciesInfo | undefined, displayLabel: string, onDone: () => void
}) {
  const [quantity, setQuantity] = useState(row.quantity)
  const [healthNotes, setHealthNotes] = useState(row.health_notes || '')
  const [growingOnNotes, setGrowingOnNotes] = useState(row.growing_on_notes || '')
  const [targetCriteria, setTargetCriteria] = useState(row.target_criteria || '')
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSaveNotes() {
    setSaving(true)
    await supabase
      .from('tubestock')
      .update({
        quantity,
        health_notes: healthNotes || null,
        growing_on_notes: growingOnNotes || null,
        target_criteria: targetCriteria || null,
      })
      .eq('id', row.id)
    setSaving(false)
    onDone()
  }

  async function handlePromote() {
    if (row.quantity < 1) return
    if (!confirm(`Promote 1 ${displayLabel} to your Collection? A placeholder record will be created — edit it in Collection afterward.`)) return

    setBusy(true)

    const placeholderName = speciesInfo?.species || row.species_name_text || 'Unnamed'

    const { data: inserted, error: insertError } = await supabase
      .from('collection')
      .insert({
        sp_no: row.sp_no,
        display_name: placeholderName,
        tree_name: `${placeholderName} (from tubestock)`,
        acquired_date: new Date().toISOString().slice(0, 10),
        source: row.source,
        development_stage: 'Pre-bonsai',
        in_collection: true,
        notes: `Promoted from tubestock batch #${row.id}.`,
      })
      .select('collection_id')
      .single()

    if (insertError || !inserted) {
      alert(`Promote failed: ${insertError?.message}`)
      setBusy(false)
      return
    }

    const newQuantity = row.quantity - 1
    const today = new Date().toISOString().slice(0, 10)

    await supabase
      .from('tubestock')
      .update({
        quantity: newQuantity,
        status: newQuantity <= 0 ? 'promoted' : 'growing_on',
        promoted_to_collection_id: inserted.collection_id,
        promoted_date: today,
      })
      .eq('id', row.id)

    setBusy(false)
    onDone()
  }

  async function handleCull() {
    const input = prompt(`How many to cull? (max ${row.quantity})`, String(row.quantity))
    if (input === null) return
    const cullQty = parseInt(input, 10)
    if (isNaN(cullQty) || cullQty < 1 || cullQty > row.quantity) {
      alert('Enter a number between 1 and the current quantity.')
      return
    }
    const reason = prompt('Reason for culling (optional):') || null

    setBusy(true)
    const newQuantity = row.quantity - cullQty
    const today = new Date().toISOString().slice(0, 10)

    await supabase
      .from('tubestock')
      .update({
        quantity: newQuantity,
        status: newQuantity <= 0 ? 'culled' : 'growing_on',
        culled_date: today,
        culled_reason: reason,
      })
      .eq('id', row.id)

    setBusy(false)
    onDone()
  }

  return (
    <main className="max-w-2xl mx-auto p-4">
      <button onClick={onDone} className="text-sm text-gray-500 mb-4">&larr; Back to list</button>
      <h1 className="text-xl font-semibold mb-1">{displayLabel}</h1>
      {speciesInfo?.common_name && <p className="text-sm text-gray-500 mb-4">{speciesInfo.common_name}</p>}

      <span className={`inline-block text-xs px-2 py-1 rounded-full mb-4 ${statusStyles[row.status] || 'bg-gray-100 text-gray-600'}`}>
        {row.status.replace('_', ' ')}
      </span>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Quantity</span>
        <input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} className={inputClass} />
      </label>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Health notes</span>
        <textarea value={healthNotes} onChange={e => setHealthNotes(e.target.value)} rows={2} className={inputClass} />
      </label>

      <label className="block text-sm mb-3">
        <span className="text-gray-500 block mb-1">Growing-on notes</span>
        <textarea value={growingOnNotes} onChange={e => setGrowingOnNotes(e.target.value)} rows={2} className={inputClass} />
      </label>

      <label className="block text-sm mb-6">
        <span className="text-gray-500 block mb-1">Target criteria (what triggers promotion)</span>
        <textarea value={targetCriteria} onChange={e => setTargetCriteria(e.target.value)} rows={2} className={inputClass} />
      </label>

      <button
        onClick={handleSaveNotes}
        disabled={saving || busy}
        className="bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold w-full text-lg disabled:opacity-50 mb-3"
      >
        {saving ? 'Saving...' : 'Save changes'}
      </button>

      {row.status === 'growing_on' && row.quantity > 0 && (
        <button
          onClick={handlePromote}
          disabled={busy}
          className="bg-green-600 text-white px-6 py-4 rounded-lg font-semibold w-full text-lg disabled:opacity-50 mb-3"
        >
          {busy ? 'Working...' : 'Promote 1 to Collection'}
        </button>
      )}

      {row.status === 'growing_on' && row.quantity > 0 && (
        <button
          onClick={handleCull}
          disabled={busy}
          className="text-red-500 text-sm w-full text-center py-2"
        >
          Cull
        </button>
      )}

      {row.status !== 'growing_on' && (
        <p className="text-sm text-gray-400 text-center">
          {row.status === 'promoted' && `Promoted ${row.promoted_date || ''}`}
          {row.status === 'culled' && `Culled ${row.culled_date || ''}${row.culled_reason ? ` \u2014 ${row.culled_reason}` : ''}`}
        </p>
      )}
    </main>
  )
}
