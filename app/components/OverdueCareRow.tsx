'use client'
import { useState } from 'react'
import Link from 'next/link'
import { TREE_DATE_FIELD_FOR_EVENT, setTreeLastDone } from '@/lib/careEventTreeDate'

// One overdue care_schedule row on the home page, with Done / Defer / Edit
// right in the list. All saves go through the existing /api/care-schedule route
// (the same one the tree page uses), so nothing new is exposed.

export type CareEvent = {
  id: number
  tree_number: number
  event_type: string
  due_date: string
  notes: string | null
}

type Props = {
  ev: CareEvent
  tree: any
  careLabel: string
  formatDate: (d: string) => string
  // Called after a successful save. patch === null means the event is finished
  // and should leave the list; otherwise the fields to merge into the event.
  onSaved: (id: number, patch: Partial<CareEvent> | null) => void
}

// Local date (not UTC) so a tap before 10am in Brisbane logs today, not yesterday.
function localDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function plusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localDate(d)
}

async function patchCare(body: Record<string, unknown>) {
  const res = await fetch('/api/care-schedule', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || res.statusText)
  }
}

const btn: React.CSSProperties = {
  fontSize: '12px',
  padding: '4px 10px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  background: 'white',
  color: '#374151',
  cursor: 'pointer',
}

export default function OverdueCareRow({ ev, tree, careLabel, formatDate, onSaved }: Props) {
  const [mode, setMode] = useState<'view' | 'defer' | 'edit'>('view')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deferDate, setDeferDate] = useState(plusDays(7))
  const [editDate, setEditDate] = useState(ev.due_date)
  const [editNotes, setEditNotes] = useState(ev.notes || '')

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e: any) {
      setError(e?.message || 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const markDone = () =>
    run(async () => {
      const today = localDate(new Date())
      // Update the tree's last-done date first (fertilise / repot / prune), so a
      // failure leaves the task open rather than closed with a stale tree record.
      const field = TREE_DATE_FIELD_FOR_EVENT[ev.event_type]
      if (field && tree?.collection_id) await setTreeLastDone(tree.collection_id, field, today)
      await patchCare({ id: ev.id, completed_date: today })
      onSaved(ev.id, null)
    })

  const saveDefer = () =>
    run(async () => {
      if (!deferDate) throw new Error('Pick a date')
      const note = `Deferred ${localDate(new Date())} from ${ev.due_date} to ${deferDate}.`
      const notes = ev.notes ? `${note} ${ev.notes}` : note
      await patchCare({ id: ev.id, due_date: deferDate, notes })
      onSaved(ev.id, { due_date: deferDate, notes })
      setMode('view')
    })

  const saveEdit = () =>
    run(async () => {
      if (!editDate) throw new Error('Pick a date')
      await patchCare({ id: ev.id, due_date: editDate, notes: editNotes })
      onSaved(ev.id, { due_date: editDate, notes: editNotes })
      setMode('view')
    })

  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          href={`/collection/${tree.collection_id}`}
          style={{ minWidth: 0, textDecoration: 'none', color: 'inherit' }}
        >
          <span style={{ fontWeight: '600', fontSize: '14px' }}>{tree.display_name || 'Unnamed Tree'}</span>
          {tree.tree_number && <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>#{tree.tree_number}</span>}
          {tree.speciesLabel && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{tree.speciesLabel}</p>}
        </Link>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
          <p style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', margin: 0 }}>{careLabel}</p>
          <p style={{ fontSize: '11px', color: '#dc2626', margin: '2px 0 0' }}>Due {formatDate(ev.due_date)}</p>
        </div>
      </div>

      {ev.notes && mode === 'view' && (
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '6px 0 0' }}>{ev.notes}</p>
      )}

      {mode === 'view' && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <button type="button" disabled={busy} onClick={markDone} style={{ ...btn, background: '#166534', borderColor: '#166534', color: 'white' }}>
            {busy ? 'Saving…' : 'Done'}
          </button>
          <button type="button" disabled={busy} onClick={() => setMode('defer')} style={btn}>Defer</button>
          <button type="button" disabled={busy} onClick={() => setMode('edit')} style={btn}>Edit</button>
        </div>
      )}

      {mode === 'defer' && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12px', color: '#6b7280' }}>New date</label>
          <input type="date" value={deferDate} onChange={e => setDeferDate(e.target.value)} style={{ fontSize: '13px', padding: '3px 6px' }} />
          <button type="button" disabled={busy} onClick={saveDefer} style={{ ...btn, background: '#166534', borderColor: '#166534', color: 'white' }}>Save</button>
          <button type="button" disabled={busy} onClick={() => setMode('view')} style={btn}>Cancel</button>
        </div>
      )}

      {mode === 'edit' && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280' }}>Due</label>
            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ fontSize: '13px', padding: '3px 6px' }} />
          </div>
          <textarea
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            rows={3}
            style={{ width: '100%', fontSize: '13px', padding: '6px', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            <button type="button" disabled={busy} onClick={saveEdit} style={{ ...btn, background: '#166534', borderColor: '#166534', color: 'white' }}>Save</button>
            <button type="button" disabled={busy} onClick={() => setMode('view')} style={btn}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: '12px', color: '#dc2626', margin: '6px 0 0' }}>Could not save: {error}</p>}
    </div>
  )
}
