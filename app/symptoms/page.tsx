'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Symptom = {
  id: number
  symptom_name: string
  category: string
  description: string | null
  image_url: string | null
  display_order: number | null
}

type Cause = {
  id: number
  symptom_id: number
  cause_name: string
  likelihood: 'Common' | 'Occasional' | 'Rare'
  explanation: string | null
  remedy: string | null
  distinguishing_signs: string | null
  data_source: string | null
  research_notes: string | null
  needs_verification: boolean
}

const CATEGORIES = ['Foliage', 'Bark & Trunk', 'Roots', 'Growth', 'Pests & Disease', 'Wilting & Decline', 'Flowers & Fruit']

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

export default function SymptomsAdmin() {
  const [symptoms, setSymptoms] = useState<Symptom[]>([])
  const [causesBySymptom, setCausesBySymptom] = useState<Record<number, Cause[]>>({})
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | string | null>(null)

  const [newSymptom, setNewSymptom] = useState({ symptom_name: '', category: CATEGORIES[0], description: '' })
  const [addingSymptom, setAddingSymptom] = useState(false)

  const [newCauseDraft, setNewCauseDraft] = useState<Record<number, Partial<Cause>>>({})

  useEffect(() => { fetchSymptoms() }, [])

  async function fetchSymptoms() {
    setLoading(true)
    try {
      const data = await api('/api/symptoms')
      setSymptoms(data || [])
      setError(null)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function fetchCauses(symptomId: number) {
    try {
      const data = await api(`/api/symptom-causes?symptom_id=${symptomId}`)
      setCausesBySymptom(prev => ({ ...prev, [symptomId]: data || [] }))
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function toggleExpand(symptomId: number) {
    if (expanded === symptomId) {
      setExpanded(null)
      return
    }
    setExpanded(symptomId)
    if (!causesBySymptom[symptomId]) await fetchCauses(symptomId)
  }

  async function handleAddSymptom() {
    if (!newSymptom.symptom_name.trim()) {
      alert('Symptom name is required.')
      return
    }
    setSavingId('new-symptom')
    try {
      await api('/api/symptoms', {
        method: 'POST',
        body: JSON.stringify({
          symptom_name: newSymptom.symptom_name.trim(),
          category: newSymptom.category,
          description: newSymptom.description.trim() || null,
        }),
      })
      setNewSymptom({ symptom_name: '', category: CATEGORIES[0], description: '' })
      setAddingSymptom(false)
      await fetchSymptoms()
    } catch (e: any) {
      alert('Could not save symptom: ' + e.message)
      setError(e.message)
    }
    setSavingId(null)
  }

  async function handleDeleteSymptom(id: number) {
    if (!confirm('Delete this symptom and all its causes? This cannot be undone.')) return
    setSavingId(id)
    try {
      await api(`/api/symptoms?id=${id}`, { method: 'DELETE' })
      await fetchSymptoms()
    } catch (e: any) {
      setError(e.message)
    }
    setSavingId(null)
  }

  async function handleAddCause(symptomId: number) {
    const draft = newCauseDraft[symptomId]
    if (!draft?.cause_name?.trim()) {
      alert('Cause name is required.')
      return
    }
    if (!draft?.likelihood) {
      alert('Pick a Likelihood (Common / Occasional / Rare) before saving.')
      return
    }
    setSavingId(`new-cause-${symptomId}`)
    try {
      await api('/api/symptom-causes', {
        method: 'POST',
        body: JSON.stringify({
          symptom_id: symptomId,
          cause_name: draft.cause_name.trim(),
          likelihood: draft.likelihood,
          explanation: draft.explanation?.trim() || null,
          remedy: draft.remedy?.trim() || null,
          distinguishing_signs: draft.distinguishing_signs?.trim() || null,
          data_source: draft.data_source?.trim() || null,
          research_notes: draft.research_notes?.trim() || null,
          needs_verification: true,
        }),
      })
      setNewCauseDraft(prev => ({ ...prev, [symptomId]: {} }))
      await fetchCauses(symptomId)
    } catch (e: any) {
      alert('Could not save cause: ' + e.message)
      setError(e.message)
    }
    setSavingId(null)
  }

  async function handleDeleteCause(causeId: number, symptomId: number) {
    if (!confirm('Delete this cause?')) return
    setSavingId(causeId)
    try {
      await api(`/api/symptom-causes?id=${causeId}`, { method: 'DELETE' })
      await fetchCauses(symptomId)
    } catch (e: any) {
      setError(e.message)
    }
    setSavingId(null)
  }

  const likelihoodColor = (l: string) => {
    if (l === 'Common') return { bg: '#dcfce7', color: '#166534' }
    if (l === 'Occasional') return { bg: '#fef3c7', color: '#92400e' }
    return { bg: '#f3f4f6', color: '#6b7280' }
  }

  const bySymptomCategory = CATEGORIES.map(cat => ({
    category: cat,
    items: symptoms.filter(s => s.category === cat),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: '4px' }}>
        <Link href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>&larr; Dashboard</Link>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 0' }}>Symptom Troubleshooting</h1>
      </div>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
        Manage the "What's wrong with my tree?" diagnostic content — symptoms and their possible causes.
      </p>

      {error && <p style={{ color: '#dc2626', marginBottom: '16px' }}>Error: {error}</p>}
      {loading && <p style={{ color: '#9ca3af' }}>Loading...</p>}

      {!loading && (
        <>
          <button
            onClick={() => setAddingSymptom(a => !a)}
            style={{ fontSize: '13px', fontWeight: 600, background: addingSymptom ? '#f3f4f6' : '#16a34a', color: addingSymptom ? '#374151' : 'white', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', marginBottom: '16px' }}
          >
            {addingSymptom ? 'Cancel' : '+ New Symptom'}
          </button>

          {addingSymptom && (
            <div style={{ border: '1px solid #d1d5db', borderRadius: '10px', padding: '16px', marginBottom: '20px', background: '#f9fafb' }}>
              <input
                type="text"
                placeholder="Symptom name (e.g. Yellowing leaves)"
                value={newSymptom.symptom_name}
                onChange={e => setNewSymptom(s => ({ ...s, symptom_name: e.target.value }))}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '8px' }}
              />
              <select
                value={newSymptom.category}
                onChange={e => setNewSymptom(s => ({ ...s, category: e.target.value }))}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '8px' }}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea
                placeholder="Description (optional) — what this looks like"
                value={newSymptom.description}
                onChange={e => setNewSymptom(s => ({ ...s, description: e.target.value }))}
                rows={2}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '8px', resize: 'vertical' }}
              />
              <button
                onClick={handleAddSymptom}
                disabled={savingId === 'new-symptom'}
                style={{ fontSize: '13px', fontWeight: 600, background: '#16a34a', color: 'white', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
              >
                {savingId === 'new-symptom' ? 'Saving...' : 'Save Symptom'}
              </button>
            </div>
          )}

          {bySymptomCategory.length === 0 && (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>No symptoms yet — add the first one above.</p>
          )}

          {bySymptomCategory.map(group => (
            <div key={group.category} style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {group.category}
              </h2>
              {group.items.map(s => (
                <div key={s.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '8px', overflow: 'hidden' }}>
                  <div
                    onClick={() => toggleExpand(s.id)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: expanded === s.id ? '#f3f4f6' : 'white' }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: '14px' }}>{s.symptom_name}</p>
                      {s.description && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{s.description}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {causesBySymptom[s.id]?.length ?? '—'} cause{causesBySymptom[s.id]?.length === 1 ? '' : 's'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSymptom(s.id) }}
                        style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>{expanded === s.id ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expanded === s.id && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#fafafa' }}>
                      {(causesBySymptom[s.id] || []).map(c => (
                        <div key={c.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <p style={{ fontWeight: 600, fontSize: '13px', margin: 0 }}>{c.cause_name}</p>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', background: likelihoodColor(c.likelihood).bg, color: likelihoodColor(c.likelihood).color, padding: '2px 8px', borderRadius: '999px' }}>
                                {c.likelihood}
                              </span>
                              {c.needs_verification && (
                                <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '999px' }}>
                                  Unverified
                                </span>
                              )}
                              <button
                                onClick={() => handleDeleteCause(c.id, s.id)}
                                style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {c.explanation && <p style={{ fontSize: '12px', color: '#4b5563', margin: '6px 0 0' }}>{c.explanation}</p>}
                          {c.remedy && <p style={{ fontSize: '12px', color: '#166534', margin: '4px 0 0' }}><strong>Remedy:</strong> {c.remedy}</p>}
                          {c.distinguishing_signs && <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}><strong>Look for:</strong> {c.distinguishing_signs}</p>}
                          {c.data_source && <p style={{ fontSize: '11px', color: '#9ca3af', margin: '6px 0 0' }}>Source: {c.data_source}</p>}
                        </div>
                      ))}

                      <div style={{ border: '1px dashed #d1d5db', borderRadius: '8px', padding: '10px 14px', marginTop: '8px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Add a cause</p>
                        <input
                          type="text"
                          placeholder="Cause name (e.g. Overwatering)"
                          value={newCauseDraft[s.id]?.cause_name || ''}
                          onChange={e => setNewCauseDraft(prev => ({ ...prev, [s.id]: { ...prev[s.id], cause_name: e.target.value } }))}
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px' }}
                        />
                        <select
                          value={newCauseDraft[s.id]?.likelihood || ''}
                          onChange={e => setNewCauseDraft(prev => ({ ...prev, [s.id]: { ...prev[s.id], likelihood: e.target.value as Cause['likelihood'] } }))}
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px' }}
                        >
                          <option value="">Likelihood...</option>
                          <option value="Common">Common</option>
                          <option value="Occasional">Occasional</option>
                          <option value="Rare">Rare</option>
                        </select>
                        <textarea
                          placeholder="Explanation"
                          value={newCauseDraft[s.id]?.explanation || ''}
                          onChange={e => setNewCauseDraft(prev => ({ ...prev, [s.id]: { ...prev[s.id], explanation: e.target.value } }))}
                          rows={2}
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px', resize: 'vertical' }}
                        />
                        <textarea
                          placeholder="Remedy"
                          value={newCauseDraft[s.id]?.remedy || ''}
                          onChange={e => setNewCauseDraft(prev => ({ ...prev, [s.id]: { ...prev[s.id], remedy: e.target.value } }))}
                          rows={2}
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px', resize: 'vertical' }}
                        />
                        <textarea
                          placeholder="Distinguishing signs (how to tell this apart from other causes)"
                          value={newCauseDraft[s.id]?.distinguishing_signs || ''}
                          onChange={e => setNewCauseDraft(prev => ({ ...prev, [s.id]: { ...prev[s.id], distinguishing_signs: e.target.value } }))}
                          rows={2}
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '6px', resize: 'vertical' }}
                        />
                        <input
                          type="text"
                          placeholder="Source (e.g. APAB-N No.3, or a specific grower/publication)"
                          value={newCauseDraft[s.id]?.data_source || ''}
                          onChange={e => setNewCauseDraft(prev => ({ ...prev, [s.id]: { ...prev[s.id], data_source: e.target.value } }))}
                          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }}
                        />
                        <button
                          onClick={() => handleAddCause(s.id)}
                          disabled={savingId === `new-cause-${s.id}`}
                          style={{ fontSize: '12px', fontWeight: 600, background: '#16a34a', color: 'white', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                        >
                          {savingId === `new-cause-${s.id}` ? 'Saving...' : 'Add Cause'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
