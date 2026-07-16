'use client'

import { useState, useEffect, use as usePromise } from 'react'
import { supabase } from '@/lib/supabase'

const statusColor: Record<string, string> = {
  active: '#16a34a',
  completed: '#2563eb',
  abandoned: '#6b7280',
}

export default function ResearchProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params)
  const projectId = parseInt(id, 10)

  const [project, setProject] = useState<any>(null)
  const [trees, setTrees] = useState<any[]>([])
  const [journal, setJournal] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingBaselineId, setEditingBaselineId] = useState<number | null>(null)
  const [baselineCaliper, setBaselineCaliper] = useState('')
  const [baselineHeight, setBaselineHeight] = useState('')
  const [baselineNotes, setBaselineNotes] = useState('')
  const [savingBaseline, setSavingBaseline] = useState(false)

  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [entryTreeId, setEntryTreeId] = useState<string>('') // '' = pod-wide
  const [entryNote, setEntryNote] = useState('')
  const [entryPhotoUrl, setEntryPhotoUrl] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)

  useEffect(() => { if (projectId) fetchAll() }, [projectId])

  async function fetchAll() {
    setLoading(true)

    const { data: projectData, error: projectError } = await supabase
      .from('research_projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError) {
      setError(projectError.message)
      setLoading(false)
      return
    }
    setProject(projectData)

    const { data: treeRows } = await supabase
      .from('research_project_trees')
      .select('*')
      .eq('project_id', projectId)

    const treeLinks = treeRows || []
    const collectionIds = treeLinks.map((t: any) => t.collection_id).filter(Boolean)
    const tubestockIds = treeLinks.map((t: any) => t.tubestock_id).filter(Boolean)
    let collectionMap: Record<string, any> = {}
    let tubestockMap: Record<number, any> = {}
    let speciesMap: Record<number, string> = {}
    const spNosNeeded = new Set<number>()

    if (collectionIds.length > 0) {
      const { data: collectionData } = await supabase
        .from('collection')
        .select('collection_id, display_name, tree_name, sp_no, image_url')
        .in('collection_id', collectionIds)
      ;(collectionData || []).forEach((c: any) => {
        collectionMap[c.collection_id] = c
        if (c.sp_no) spNosNeeded.add(c.sp_no)
      })
    }

    if (tubestockIds.length > 0) {
      const { data: tubestockData } = await supabase
        .from('tubestock')
        .select('id, tubestock_number, sp_no, species_name_text, quantity, source')
        .in('id', tubestockIds)
      ;(tubestockData || []).forEach((t: any) => {
        tubestockMap[t.id] = t
        if (t.sp_no) spNosNeeded.add(t.sp_no)
      })
    }

    if (spNosNeeded.size > 0) {
      const { data: spData } = await supabase.from('species').select('sp_no, species, common_name').in('sp_no', Array.from(spNosNeeded))
      ;(spData || []).forEach((s: any) => {
        speciesMap[s.sp_no] = s.species + (s.common_name && s.common_name !== 'Unknown' ? ' \u2014 ' + s.common_name : '')
      })
    }

    setTrees(treeLinks.map((t: any) => {
      if (t.collection_id && collectionMap[t.collection_id]) {
        const c = collectionMap[t.collection_id]
        return {
          ...t,
          displayName: c.display_name || c.tree_name || 'Unnamed tree',
          speciesLabel: speciesMap[c.sp_no] || '',
          imageUrl: c.image_url || null,
          sourceLabel: null,
        }
      }
      if (t.tubestock_id && tubestockMap[t.tubestock_id]) {
        const ts = tubestockMap[t.tubestock_id]
        return {
          ...t,
          displayName: (ts.tubestock_number ? ts.tubestock_number + ' \u2014 ' : '') + (speciesMap[ts.sp_no] || ts.species_name_text || 'Unnamed'),
          speciesLabel: speciesMap[ts.sp_no] || ts.species_name_text || '',
          imageUrl: null,
          sourceLabel: ts.source || null,
        }
      }
      return { ...t, displayName: 'Unlinked entry', speciesLabel: '', imageUrl: null, sourceLabel: null }
    }))

    const { data: journalRows } = await supabase
      .from('research_project_journal')
      .select('*')
      .eq('project_id', projectId)
      .order('entry_date', { ascending: false })

    setJournal((journalRows || []).map((j: any) => {
      const c = j.collection_id ? collectionMap[j.collection_id] : null
      return { ...j, treeName: c ? (c.display_name || c.tree_name) : null }
    }))
    // Note: journal entries are tied to collection_id only (pod-wide vs one tree).
    // If a tree has since moved to tubestock, its past journal entries will show as "Pod-wide"
    // since the collection_id lookup will no longer resolve. Not fixed here \u2014 flag if this matters.

    setError(null)
    setLoading(false)
  }

  function openBaselineEditor(t: any) {
    setEditingBaselineId(t.id)
    setBaselineCaliper(t.baseline_caliper_mm ?? '')
    setBaselineHeight(t.baseline_height_mm ?? '')
    setBaselineNotes(t.baseline_notes || '')
  }

  async function handleSaveBaseline(treeRowId: number) {
    setSavingBaseline(true)
    await supabase
      .from('research_project_trees')
      .update({
        baseline_date: new Date().toISOString().slice(0, 10),
        baseline_caliper_mm: baselineCaliper === '' ? null : parseFloat(baselineCaliper),
        baseline_height_mm: baselineHeight === '' ? null : parseFloat(baselineHeight),
        baseline_notes: baselineNotes || null,
      })
      .eq('id', treeRowId)
    setSavingBaseline(false)
    setEditingBaselineId(null)
    fetchAll()
  }

  async function handleAddEntry() {
    if (!entryNote.trim()) { alert('Note is required.'); return }
    setSavingEntry(true)
    const { error } = await supabase
      .from('research_project_journal')
      .insert({
        project_id: projectId,
        collection_id: entryTreeId || null,
        entry_date: entryDate,
        note: entryNote.trim(),
        photo_url: entryPhotoUrl.trim() || null,
      })
    setSavingEntry(false)
    if (error) { alert('Error: ' + error.message); return }
    setEntryNote('')
    setEntryPhotoUrl('')
    fetchAll()
  }

  if (loading) return <main style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}><p style={{ color: '#9ca3af' }}>Loading...</p></main>
  if (error) return <main style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}><p style={{ color: '#dc2626' }}>Error: {error}</p></main>
  if (!project) return null

  return (
    <main style={{ maxWidth: '900px', width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>
      <a href="/research-projects" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>&larr; Research Projects</a>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '4px 0 4px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{project.title}</h1>
        <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: (statusColor[project.status] || '#6b7280') + '22', color: statusColor[project.status] || '#6b7280', textTransform: 'capitalize' }}>
          {project.status}
        </span>
      </div>

      {project.hypothesis && (
        <div style={{ marginBottom: '10px' }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', margin: '0 0 2px' }}>Hypothesis</p>
          <p style={{ fontSize: '14px', color: '#374151', margin: 0 }}>{project.hypothesis}</p>
        </div>
      )}
      {project.methodology && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', margin: '0 0 2px' }}>Methodology</p>
          <p style={{ fontSize: '14px', color: '#374151', margin: 0 }}>{project.methodology}</p>
        </div>
      )}
      <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '24px' }}>
        {project.start_date ? `Started ${project.start_date}` : ''}{project.end_date ? ` \u00b7 Ended ${project.end_date}` : ''}
      </p>

      <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 10px' }}>Trees in this project ({trees.length})</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', marginBottom: '28px' }}>
        {trees.map(t => (
          <div key={t.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              {t.imageUrl ? (
                <img src={t.imageUrl} alt="" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '48px', height: '48px', background: '#f1f5f9', borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>&#127807;</div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontWeight: '600', fontSize: '14px', margin: 0 }}>{t.displayName}</p>
                {t.speciesLabel && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{t.speciesLabel}</p>}
                {t.sourceLabel && <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>{t.sourceLabel}</p>}
              </div>
            </div>

            {editingBaselineId === t.id ? (
              <div style={{ marginTop: '10px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Caliper (mm)</label>
                <input type="number" value={baselineCaliper} onChange={e => setBaselineCaliper(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px' }} />
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Height (mm)</label>
                <input type="number" value={baselineHeight} onChange={e => setBaselineHeight(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px' }} />
                <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Notes</label>
                <textarea value={baselineNotes} onChange={e => setBaselineNotes(e.target.value)} rows={2}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setEditingBaselineId(null)} style={{ flex: 1, padding: '6px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => handleSaveBaseline(t.id)} disabled={savingBaseline} style={{ flex: 1, padding: '6px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    {savingBaseline ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#6b7280' }}>
                {t.baseline_date ? (
                  <>
                    <p style={{ margin: '0 0 2px' }}>Baseline ({t.baseline_date}): {t.baseline_caliper_mm ?? '\u2014'}mm caliper, {t.baseline_height_mm ?? '\u2014'}mm height</p>
                    {t.baseline_notes && <p style={{ margin: '0 0 6px', fontStyle: 'italic' }}>{t.baseline_notes}</p>}
                  </>
                ) : (
                  <p style={{ margin: '0 0 6px' }}>No baseline recorded yet.</p>
                )}
                <button onClick={() => openBaselineEditor(t)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                  {t.baseline_date ? 'Update baseline' : 'Record baseline'}
                </button>
              </div>
            )}
          </div>
        ))}
        {trees.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px' }}>No trees linked to this project.</p>}
      </div>

      <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 10px' }}>Journal</h2>

      <div style={{ background: '#f9fafb', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Date</label>
        <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }} />

        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Tree</label>
        <select value={entryTreeId} onChange={e => setEntryTreeId(e.target.value)}
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', marginBottom: '8px' }}>
          <option value="">Pod-wide note</option>
          {trees.map(t => <option key={t.collection_id} value={t.collection_id}>{t.displayName}</option>)}
        </select>

        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Note</label>
        <textarea value={entryNote} onChange={e => setEntryNote(e.target.value)} rows={3}
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }} />

        <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Photo URL (optional)</label>
        <input type="text" value={entryPhotoUrl} onChange={e => setEntryPhotoUrl(e.target.value)}
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '10px' }} />

        <button onClick={handleAddEntry} disabled={savingEntry}
          style={{ width: '100%', padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
          {savingEntry ? 'Saving...' : 'Add Journal Entry'}
        </button>
      </div>

      <div>
        {journal.map(j => (
          <div key={j.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>{j.entry_date}</span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{j.treeName || 'Pod-wide'}</span>
            </div>
            <p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0' }}>{j.note}</p>
            {j.photo_url && <img src={j.photo_url} alt="" style={{ marginTop: '6px', maxWidth: '100%', borderRadius: '8px' }} />}
          </div>
        ))}
        {journal.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px' }}>No journal entries yet.</p>}
      </div>
    </main>
  )
}
