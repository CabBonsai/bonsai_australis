'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px',
  padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box',
}

type Tubestock = {
  id: number
  tubestock_number: string | null
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

type Project = {
  id: number
  title: string
  status: string
}

const statusColor: Record<string, string> = {
  growing_on: '#2563eb',
  promoted: '#16a34a',
  culled: '#6b7280',
}

function padTag(n: number) {
  return String(n).padStart(3, '0')
}

export default function TubestockAdmin() {
  const [rows, setRows] = useState<Tubestock[]>([])
  const [speciesMap, setSpeciesMap] = useState<Record<number, SpeciesInfo>>({})
  const [projects, setProjects] = useState<Project[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [linkedIds, setLinkedIds] = useState<Set<number>>(new Set())

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

    const { data: projectData } = await supabase
      .from('research_projects')
      .select('id, title, status')
      .eq('status', 'active')
      .order('title', { ascending: true })
    setProjects(projectData || [])

    // Research-pod badge: which tubestock batches are linked to a research project.
    const { data: linkData } = await supabase
      .from('research_project_trees')
      .select('tubestock_id')
      .not('tubestock_id', 'is', null)
    setLinkedIds(new Set((linkData || []).map((l: any) => l.tubestock_id)))

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
      (r.source || '').toLowerCase().includes(q) ||
      (r.tubestock_number || '').toLowerCase().includes(q)
    )
  })

  if (fetchError) return <main style={{ maxWidth: '700px', margin: '0 auto', padding: '16px' }}><p style={{ color: '#dc2626' }}>Error: {fetchError}</p></main>
  if (loading) return <main style={{ maxWidth: '700px', margin: '0 auto', padding: '16px' }}><p style={{ color: '#9ca3af' }}>Loading...</p></main>

  if (creating) {
    return <TubestockCreateForm onDone={() => { setCreating(false); fetchAll() }} onCancel={() => setCreating(false)} />
  }

  if (editingId !== null) {
    const row = rows.find(r => r.id === editingId)
    if (!row) return null
    return (
      <TubestockEditor
        row={row}
        speciesInfo={row.sp_no ? speciesMap[row.sp_no] : undefined}
        displayLabel={label(row)}
        projects={projects}
        isLinkedToResearch={linkedIds.has(row.id)}
        onDone={() => { setEditingId(null); fetchAll() }}
      />
    )
  }

  return (
    <main style={{ maxWidth: '700px', width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>
      <a href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>&larr; Admin Home</a>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>Tubestock</h1>
        <button
          onClick={() => setCreating(true)}
          style={{ fontSize: '13px', fontWeight: '600', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer' }}
        >
          + New Tubestock
        </button>
      </div>

      <input
        type="text"
        placeholder="Search tubestock..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...inputStyle, marginBottom: '16px' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map(row => {
          const info = row.sp_no ? speciesMap[row.sp_no] : undefined
          return (
            <button
              key={row.id}
              onClick={() => setEditingId(row.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left',
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: '600', fontSize: '14px', margin: 0 }}>
                  {row.tubestock_number && <span style={{ color: '#9ca3af', fontFamily: 'monospace', marginRight: '8px' }}>{row.tubestock_number}</span>}
                  {label(row)}
                </p>
                {info?.common_name && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{info.common_name}</p>}
                {row.sp_no && <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>sp_no {row.sp_no}</p>}
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0' }}>
                  Qty {row.quantity}{row.source ? ` \u00b7 ${row.source}` : ''}{row.acquisition_date ? ` \u00b7 ${row.acquisition_date}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', flexShrink: 0 }}>
                <span style={{
                  fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
                  background: (statusColor[row.status] || '#6b7280') + '22', color: statusColor[row.status] || '#6b7280',
                }}>
                  {row.status.replace('_', ' ')}
                </span>
                {linkedIds.has(row.id) && (
                  <span style={{
                    fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
                    background: '#05966922', color: '#059669',
                  }}>
                    Research Pod
                  </span>
                )}
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px' }}>No tubestock match.</p>}
      </div>
    </main>
  )
}

function TubestockEditor({ row, speciesInfo, displayLabel, projects, isLinkedToResearch, onDone }: {
  row: Tubestock, speciesInfo: SpeciesInfo | undefined, displayLabel: string, projects: Project[], isLinkedToResearch: boolean, onDone: () => void
}) {
  const [quantity, setQuantity] = useState(row.quantity)
  const [healthNotes, setHealthNotes] = useState(row.health_notes || '')
  const [growingOnNotes, setGrowingOnNotes] = useState(row.growing_on_notes || '')
  const [targetCriteria, setTargetCriteria] = useState(row.target_criteria || '')
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('')

  const batchCode = row.tubestock_number || `TS${String(row.id).padStart(4, '0')}`
  const plantTags = Array.from({ length: row.quantity }, (_, i) => `${batchCode}/${padTag(row.quantity - i)}`)
  const nextTag = row.quantity > 0 ? `${batchCode}/${padTag(row.quantity)}` : null

  async function createCollectionRow(tag: string | null) {
    const placeholderName = speciesInfo?.species || row.species_name_text || 'Unnamed'
    return supabase
      .from('collection')
      .insert({
        sp_no: row.sp_no,
        display_name: placeholderName,
        tree_name: `${placeholderName} (from tubestock)`,
        acquired_date: new Date().toISOString().slice(0, 10),
        source: row.source,
        development_stage: 'Pre-bonsai',
        in_collection: true,
        notes: `Promoted from tubestock batch ${tag || batchCode}.`,
        origin_tubestock_tag: tag || batchCode,
      })
      .select('collection_id')
      .single()
  }

  async function decrementTubestock(collectionId: string | null) {
    const newQuantity = row.quantity - 1
    const today = new Date().toISOString().slice(0, 10)
    await supabase
      .from('tubestock')
      .update({
        quantity: newQuantity,
        status: newQuantity <= 0 ? 'promoted' : 'growing_on',
        promoted_to_collection_id: collectionId,
        promoted_date: today,
      })
      .eq('id', row.id)
  }

  function promptForTag(): string | null {
    return prompt(`Which tag is leaving the batch? (its number gets replaced by a Collection tree number)`, nextTag || '')
  }

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

  async function handlePromoteToCollection() {
    if (row.quantity < 1) return
    const tag = promptForTag()
    if (tag === null) return
    if (!confirm(`Promote ${tag} to your Collection? A placeholder record will be created \u2014 edit it in Collection afterward.`)) return

    setBusy(true)
    const { data: inserted, error: insertError } = await createCollectionRow(tag)

    if (insertError || !inserted) {
      alert(`Promote failed: ${insertError?.message}`)
      setBusy(false)
      return
    }

    await decrementTubestock(inserted.collection_id)
    setBusy(false)
    onDone()
  }

  async function handlePromoteToResearchPod() {
    if (!selectedProjectId) {
      alert('Pick a research project first.')
      return
    }
    if (row.quantity < 1) return
    const tag = promptForTag()
    if (tag === null) return

    setBusy(true)

    // Research pod trees stay in the research pipeline only \u2014 no Collection row,
    // no bonsai_collection_number. Only research_project_trees gets written here.
    const { error: linkError } = await supabase
      .from('research_project_trees')
      .insert({
        project_id: selectedProjectId,
        tubestock_id: row.id,
        sp_no: row.sp_no,
        baseline_notes: `From tubestock ${tag || batchCode}.`,
      })

    if (linkError) {
      alert(`Linking to the research project failed: ${linkError.message}`)
      setBusy(false)
      return
    }

    await decrementTubestock(null)
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
    const tagsInput = prompt(`Which tag numbers were culled? (e.g. ${plantTags.slice(0, cullQty).join(', ')})`, plantTags.slice(0, cullQty).join(', ')) || ''
    const reason = prompt('Reason for culling (optional):') || null
    const fullReason = [tagsInput ? `Tags: ${tagsInput}.` : null, reason].filter(Boolean).join(' ')

    setBusy(true)
    const newQuantity = row.quantity - cullQty
    const today = new Date().toISOString().slice(0, 10)

    await supabase
      .from('tubestock')
      .update({
        quantity: newQuantity,
        status: newQuantity <= 0 ? 'culled' : 'growing_on',
        culled_date: today,
        culled_reason: fullReason || null,
      })
      .eq('id', row.id)

    setBusy(false)
    onDone()
  }

  return (
    <main style={{ maxWidth: '700px', width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>
      <button onClick={onDone} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '12px' }}>
        &larr; Back to list
      </button>

      <p style={{ fontSize: '13px', color: '#9ca3af', fontFamily: 'monospace', margin: '0 0 4px' }}>{batchCode}</p>
      <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px' }}>{displayLabel}</h1>
      {speciesInfo?.common_name && <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 4px' }}>{speciesInfo.common_name}</p>}
      {row.sp_no && <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 12px' }}>sp_no {row.sp_no}</p>}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-block', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
          background: (statusColor[row.status] || '#6b7280') + '22', color: statusColor[row.status] || '#6b7280',
        }}>
          {row.status.replace('_', ' ')}
        </span>
        {isLinkedToResearch && (
          <span style={{
            display: 'inline-block', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
            background: '#05966922', color: '#059669',
          }}>
            Linked to Research Pod
          </span>
        )}
      </div>

      {row.quantity > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 6px' }}>Plant tags (for pot labels)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {plantTags.map(tag => (
              <span key={tag} style={{ fontSize: '12px', fontFamily: 'monospace', background: '#f1f5f9', color: '#374151', borderRadius: '6px', padding: '4px 8px' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '12px' }}>
        <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Quantity</span>
        <input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} style={inputStyle} />
      </label>

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '12px' }}>
        <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Health notes</span>
        <textarea value={healthNotes} onChange={e => setHealthNotes(e.target.value)} rows={2} style={inputStyle} />
      </label>

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '12px' }}>
        <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Growing-on notes</span>
        <textarea value={growingOnNotes} onChange={e => setGrowingOnNotes(e.target.value)} rows={2} style={inputStyle} />
      </label>

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '20px' }}>
        <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Target criteria (what triggers promotion)</span>
        <textarea value={targetCriteria} onChange={e => setTargetCriteria(e.target.value)} rows={2} style={inputStyle} />
      </label>

      <button
        onClick={handleSaveNotes}
        disabled={saving || busy}
        style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px', opacity: (saving || busy) ? 0.5 : 1 }}
      >
        {saving ? 'Saving...' : 'Save changes'}
      </button>

      {row.status === 'growing_on' && row.quantity > 0 && !showProjectPicker && (
        <>
          <button
            onClick={handlePromoteToCollection}
            disabled={busy}
            style={{ width: '100%', padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px', opacity: busy ? 0.5 : 1 }}
          >
            {busy ? 'Working...' : 'Promote 1 to Collection'}
          </button>

          <button
            onClick={() => setShowProjectPicker(true)}
            disabled={busy || projects.length === 0}
            style={{ width: '100%', padding: '12px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px', opacity: (busy || projects.length === 0) ? 0.5 : 1 }}
          >
            {projects.length === 0 ? 'No active research projects' : 'Promote 1 to Research Pod'}
          </button>
        </>
      )}

      {showProjectPicker && (
        <div style={{ background: '#f9fafb', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '12px' }}>
            <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Which research project?</span>
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value ? parseInt(e.target.value, 10) : '')}
              style={inputStyle}
            >
              <option value="">Select a project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { setShowProjectPicker(false); setSelectedProjectId('') }}
              disabled={busy}
              style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handlePromoteToResearchPod}
              disabled={busy || !selectedProjectId}
              style={{ flex: 1, padding: '10px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: (busy || !selectedProjectId) ? 0.5 : 1 }}
            >
              {busy ? 'Working...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {row.status === 'growing_on' && row.quantity > 0 && !showProjectPicker && (
        <button
          onClick={handleCull}
          disabled={busy}
          style={{ width: '100%', padding: '8px', background: 'none', border: 'none', color: '#dc2626', fontSize: '13px', cursor: 'pointer', textAlign: 'center' }}
        >
          Cull
        </button>
      )}

      {row.status !== 'growing_on' && (
        <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
          {row.status === 'promoted' && `Promoted ${row.promoted_date || ''}`}
          {row.status === 'culled' && `Culled ${row.culled_date || ''}${row.culled_reason ? ` \u2014 ${row.culled_reason}` : ''}`}
        </p>
      )}
    </main>
  )
}

function TubestockCreateForm({ onDone, onCancel }: { onDone: () => void, onCancel: () => void }) {
  const [speciesQuery, setSpeciesQuery] = useState('')
  const [speciesResults, setSpeciesResults] = useState<{ sp_no: number, species: string, common_name: string | null }[]>([])
  const [selectedSpNo, setSelectedSpNo] = useState<number | null>(null)
  const [selectedSpeciesLabel, setSelectedSpeciesLabel] = useState('')
  const [speciesNameText, setSpeciesNameText] = useState('')
  const [tubestockNumber, setTubestockNumber] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [source, setSource] = useState('')
  const [acquisitionDate, setAcquisitionDate] = useState('')
  const [healthNotes, setHealthNotes] = useState('')
  const [growingOnNotes, setGrowingOnNotes] = useState('')
  const [targetCriteria, setTargetCriteria] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedSpNo !== null) return // don't search once a species is picked
    if (speciesQuery.trim().length < 2) { setSpeciesResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('species')
        .select('sp_no, species, common_name')
        .or(`species.ilike.%${speciesQuery}%,common_name.ilike.%${speciesQuery}%`)
        .limit(8)
      setSpeciesResults(data || [])
    }, 250)
    return () => clearTimeout(timer)
  }, [speciesQuery, selectedSpNo])

  function pickSpecies(s: { sp_no: number, species: string, common_name: string | null }) {
    setSelectedSpNo(s.sp_no)
    setSelectedSpeciesLabel(s.species + (s.common_name && s.common_name !== 'Unknown' ? ` \u2014 ${s.common_name}` : ''))
    setSpeciesQuery('')
    setSpeciesResults([])
  }

  function clearSpecies() {
    setSelectedSpNo(null)
    setSelectedSpeciesLabel('')
  }

  async function handleCreate() {
    if (quantity < 1) {
      setSaveError('Quantity must be at least 1.')
      return
    }
    if (!selectedSpNo && !speciesNameText.trim()) {
      setSaveError('Either pick a species from the database, or type a species name in the fallback field below.')
      return
    }
    setSaving(true)
    setSaveError(null)

    const { error } = await supabase.from('tubestock').insert({
      tubestock_number: tubestockNumber.trim() || null,
      sp_no: selectedSpNo,
      species_name_text: selectedSpNo ? null : speciesNameText.trim(),
      quantity,
      source: source.trim() || null,
      acquisition_date: acquisitionDate || null,
      health_notes: healthNotes.trim() || null,
      growing_on_notes: growingOnNotes.trim() || null,
      target_criteria: targetCriteria.trim() || null,
      status: 'growing_on',
    })

    setSaving(false)

    if (error) {
      setSaveError(error.message)
      return
    }
    onDone()
  }

  return (
    <main style={{ maxWidth: '700px', width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>
      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '12px' }}>
        &larr; Back to list
      </button>

      <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 16px' }}>New Tubestock Batch</h1>

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>
        <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Species</span>
      </label>

      {selectedSpNo !== null ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>{selectedSpeciesLabel}</span>
          <button onClick={clearSpecies} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '13px', cursor: 'pointer' }}>Change</button>
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder="Search species by name..."
            value={speciesQuery}
            onChange={e => setSpeciesQuery(e.target.value)}
            style={{ ...inputStyle, marginBottom: '4px' }}
          />
          {speciesResults.length > 0 && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '12px', overflow: 'hidden' }}>
              {speciesResults.map(s => (
                <button
                  key={s.sp_no}
                  onClick={() => pickSpecies(s)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: '#fff', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '13px' }}
                >
                  {s.species}{s.common_name && s.common_name !== 'Unknown' ? ` \u2014 ${s.common_name}` : ''}
                  <span style={{ color: '#9ca3af', marginLeft: '6px' }}>sp_no {s.sp_no}</span>
                </button>
              ))}
            </div>
          )}
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '12px' }}>
            <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>No match in database? Type a name here instead (fallback, unlinked)</span>
            <input
              type="text"
              value={speciesNameText}
              onChange={e => setSpeciesNameText(e.target.value)}
              placeholder="e.g. Acacia sp. (unidentified)"
              style={inputStyle}
            />
          </label>
        </>
      )}

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '12px' }}>
        <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Tubestock number (optional \u2014 leave blank to auto-generate from ID)</span>
        <input type="text" value={tubestockNumber} onChange={e => setTubestockNumber(e.target.value)} placeholder="e.g. TS0014" style={inputStyle} />
      </label>

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '12px' }}>
        <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Quantity</span>
        <input type="number" min={1} value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} style={inputStyle} />
      </label>

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '12px' }}>
        <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Source</span>
        <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. Nursery, Cutting, Seed" style={inputStyle} />
      </label>

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '12px' }}>
        <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Acquisition date</span>
        <input type="date" value={acquisitionDate} onChange={e => setAcquisitionDate(e.target.value)} style={inputStyle} />
      </label>

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '12px' }}>
        <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Health notes</span>
        <textarea value={healthNotes} onChange={e => setHealthNotes(e.target.value)} rows={2} style={inputStyle} />
      </label>

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '12px' }}>
        <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Growing-on notes</span>
        <textarea value={growingOnNotes} onChange={e => setGrowingOnNotes(e.target.value)} rows={2} style={inputStyle} />
      </label>

      <label style={{ display: 'block', fontSize: '13px', marginBottom: '20px' }}>
        <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>Target criteria (what triggers promotion)</span>
        <textarea value={targetCriteria} onChange={e => setTargetCriteria(e.target.value)} rows={2} style={inputStyle} />
      </label>

      {saveError && <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{saveError}</p>}

      <button
        onClick={handleCreate}
        disabled={saving}
        style={{ width: '100%', padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
      >
        {saving ? 'Creating...' : 'Create Tubestock Batch'}
      </button>
    </main>
  )
}
