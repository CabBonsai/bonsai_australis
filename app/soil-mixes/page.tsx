'use client'

// app/soil-mixes/page.tsx
//
// The list of named potting mixes. A tree picks one of these from the "Soil Mix
// Used" dropdown on its page. Reads and writes go through /api/soil-mixes
// (service role).

import { useEffect, useState } from 'react'
import Link from 'next/link'

type TreeRef = { collection_id: string; tree_number: number | null; display_name: string | null }

type Mix = {
  id: string
  name: string
  recipe: string | null
  organic_percent: string | null
  intended_for: string | null
  avoid_for: string | null
  rationale: string | null
  status: string
  result_notes: string | null
  archived: boolean
  trees: TreeRef[]
}

type Draft = {
  name: string
  recipe: string
  organic_percent: string
  intended_for: string
  avoid_for: string
  rationale: string
  status: string
  result_notes: string
}

const STATUSES = ['Untested', 'Trialling', 'In use', 'Proven', 'Retired']

const EMPTY: Draft = {
  name: '',
  recipe: '',
  organic_percent: '',
  intended_for: '',
  avoid_for: '',
  rationale: '',
  status: 'Untested',
  result_notes: '',
}

const FIELDS: { key: keyof Draft; label: string; rows?: number; hint?: string }[] = [
  { key: 'recipe', label: 'Recipe (parts)', rows: 3, hint: 'e.g. 2 zeolite : 2 fine bark : 2 decomposed granite' },
  { key: 'organic_percent', label: 'Organic content', hint: 'e.g. About 60%' },
  { key: 'intended_for', label: 'Intended for', rows: 2 },
  { key: 'avoid_for', label: 'Do not use for', rows: 2 },
  { key: 'rationale', label: 'Why this mix', rows: 3 },
  { key: 'result_notes', label: 'Results so far', rows: 3, hint: 'Update after each repot' },
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #e2dac2',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '16px',
  fontFamily: 'inherit',
  color: '#2b2620',
  background: '#fffefb',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#8a7f5f',
  marginBottom: '6px',
}

function toDraft(m: Mix): Draft {
  return {
    name: m.name,
    recipe: m.recipe ?? '',
    organic_percent: m.organic_percent ?? '',
    intended_for: m.intended_for ?? '',
    avoid_for: m.avoid_for ?? '',
    rationale: m.rationale ?? '',
    status: m.status,
    result_notes: m.result_notes ?? '',
  }
}

export default function SoilMixesPage() {
  const [mixes, setMixes] = useState<Mix[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/soil-mixes')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load mixes')
      setMixes(json.mixes)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  function startNew() {
    setDraft(EMPTY)
    setEditingId('new')
    setError(null)
  }

  function startEdit(m: Mix) {
    setDraft(toDraft(m))
    setEditingId(m.id)
    setError(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const isNew = editingId === 'new'
      const res = await fetch('/api/soil-mixes', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? draft : { id: editingId, ...draft }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')
      setEditingId(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function setArchived(m: Mix, archived: boolean) {
    setError(null)
    const res = await fetch('/api/soil-mixes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id, archived }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Failed to update')
      return
    }
    load()
  }

  async function remove(m: Mix) {
    if (!confirm(`Delete "${m.name}" permanently?`)) return
    setError(null)
    const res = await fetch(`/api/soil-mixes?id=${m.id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Failed to delete')
      return
    }
    load()
  }

  const visible = mixes.filter((m) => showArchived || !m.archived)
  const archivedCount = mixes.filter((m) => m.archived).length

  const form = (
    <div style={{ border: '1.5px solid #b9a96a', borderRadius: '12px', padding: '18px', background: '#fffdf3', marginBottom: '16px' }}>
      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Name</label>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          style={inputStyle}
          placeholder="e.g. Drier Working Mix"
          autoFocus
        />
      </div>
      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Status</label>
        <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} style={inputStyle}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {FIELDS.map((f) => (
        <div key={f.key} style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>{f.label}</label>
          {f.rows ? (
            <textarea
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              rows={f.rows}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder={f.hint}
            />
          ) : (
            <input
              type="text"
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              style={inputStyle}
              placeholder={f.hint}
            />
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={save}
          disabled={saving || !draft.name.trim()}
          style={{ background: '#3f5228', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '15px', cursor: 'pointer', opacity: saving || !draft.name.trim() ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : 'Save mix'}
        </button>
        <button
          onClick={() => setEditingId(null)}
          style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '15px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 16px 60px', color: '#2b2620' }}>
      <div style={{ marginBottom: '8px' }}>
        <Link href="/" style={{ fontSize: '14px', color: '#3f5228' }}>← Dashboard</Link>
      </div>
      <h1 style={{ fontSize: '28px', margin: '0 0 6px' }}>Soil Mixes</h1>
      <p style={{ margin: '0 0 18px', color: '#6b6248', fontSize: '15px' }}>
        Your named potting mixes. Pick one from the Soil Mix Used dropdown on a tree&apos;s page.
      </p>

      {error && (
        <div style={{ background: '#fdecec', color: '#8a1c1c', border: '1px solid #e8b4b4', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          onClick={startNew}
          style={{ background: '#3f5228', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '15px', cursor: 'pointer' }}
        >
          + New mix
        </button>
        {archivedCount > 0 && (
          <label style={{ fontSize: '14px', color: '#6b6248', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived ({archivedCount})
          </label>
        )}
      </div>

      {editingId === 'new' && form}

      {loading && <p>Loading…</p>}
      {!loading && visible.length === 0 && editingId !== 'new' && (
        <p style={{ color: '#6b6248' }}>No mixes yet. Add your first one above.</p>
      )}

      {visible.map((m) =>
        editingId === m.id ? (
          <div key={m.id}>{form}</div>
        ) : (
          <div
            key={m.id}
            style={{ border: '1px solid #e2dac2', borderRadius: '12px', padding: '16px 18px', marginBottom: '14px', background: m.archived ? '#f6f4ec' : '#fffefb', opacity: m.archived ? 0.8 : 1 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>{m.name}</h2>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#3f5228', background: '#f3f7ea', border: '1px solid #cdd9b4', borderRadius: '6px', padding: '2px 8px' }}>
                {m.archived ? 'Archived' : m.status}
              </span>
            </div>
            {m.recipe && <p style={{ margin: '10px 0 4px', fontSize: '16px', fontWeight: 600 }}>{m.recipe}</p>}
            {m.organic_percent && <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b6248' }}>Organic: {m.organic_percent}</p>}
            {m.intended_for && <p style={{ margin: '6px 0', fontSize: '14px' }}><strong>Use for:</strong> {m.intended_for}</p>}
            {m.avoid_for && <p style={{ margin: '6px 0', fontSize: '14px' }}><strong>Do not use for:</strong> {m.avoid_for}</p>}
            {m.rationale && <p style={{ margin: '6px 0', fontSize: '14px' }}><strong>Why:</strong> {m.rationale}</p>}
            {m.result_notes && <p style={{ margin: '6px 0', fontSize: '14px' }}><strong>Results:</strong> {m.result_notes}</p>}
            <p style={{ margin: '10px 0 0', fontSize: '14px' }}>
              <strong>Trees using it ({m.trees.length}):</strong>{' '}
              {m.trees.length === 0
                ? 'none yet'
                : m.trees.map((t, i) => (
                    <span key={t.collection_id}>
                      {i > 0 && ', '}
                      <Link href={`/collection/${t.collection_id}`} style={{ color: '#3f5228' }}>
                        {t.display_name ?? `Tree ${t.tree_number}`}
                      </Link>
                    </span>
                  ))}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => startEdit(m)} style={smallBtn}>Edit</button>
              <button onClick={() => setArchived(m, !m.archived)} style={smallBtn}>
                {m.archived ? 'Restore' : 'Archive'}
              </button>
              {m.trees.length === 0 && (
                <button onClick={() => remove(m)} style={{ ...smallBtn, color: '#8a1c1c' }}>Delete</button>
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}

const smallBtn: React.CSSProperties = {
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '6px 12px',
  fontSize: '13px',
  cursor: 'pointer',
}
