'use client'

// app/reminders/page.tsx
//
// General reminders for anything with a due date: a photo of a wire scar, a
// re-feed, a pot check. Reads and writes go through /api/reminders (service
// role). Open reminders also appear in the dashboard's Overdue and Due Soon
// sections.

import { useEffect, useState } from 'react'

type Reminder = {
  id: string
  title: string
  due_date: string // yyyy-mm-dd
  related: string | null
  notes: string | null
  completed_date: string | null
  created_at: string
}

const C = {
  bg: '#eef1ec',
  panel: '#ffffff',
  ink: '#16241b',
  muted: '#4a5a50',
  line: '#b9c4bb',
  accent: '#1c4fa8',
  accentInk: '#ffffff',
  overdueBg: '#fdecec',
  overdueInk: '#8a1c1c',
  soonBg: '#fff1c9',
  soonInk: '#5a3f00',
  err: '#9b1c1c',
}

const HEAD_FONT = '"Barlow Semi Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif'
const BODY_FONT = '"Barlow", "Helvetica Neue", Arial, sans-serif'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Local dates (not toISOString): in Brisbane toISOString() is a day behind
// before 10am.
function isoFromDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function todayISO(): string {
  return isoFromDate(new Date())
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return isoFromDate(new Date(y, m - 1, d + n))
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000)
}

function niceDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DAYS[dt.getDay()]} ${d} ${MONTHS[m - 1]}`
}

function dueText(r: Reminder, today: string): string {
  const diff = daysBetween(today, r.due_date)
  if (diff < 0) {
    const n = -diff
    return `Overdue by ${n} ${n === 1 ? 'day' : 'days'} (was due ${niceDate(r.due_date)})`
  }
  if (diff === 0) return `Due today (${niceDate(r.due_date)})`
  if (diff === 1) return `Due tomorrow (${niceDate(r.due_date)})`
  return `Due ${niceDate(r.due_date)}, in ${diff} days`
}

async function api(method: string, url: string, body?: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`)
  return data
}

export default function RemindersPage() {
  const [items, setItems] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [due, setDue] = useState(addDays(todayISO(), 14))
  const [related, setRelated] = useState('')
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eDue, setEDue] = useState('')
  const [eRelated, setERelated] = useState('')
  const [eNotes, setENotes] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const data = (await api('GET', '/api/reminders')) as Reminder[]
      setItems(data)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load reminders.')
    }
    setLoading(false)
  }

  async function addReminder() {
    const t = title.trim()
    if (!t) {
      setMsg('Give the reminder a title first.')
      return
    }
    setAdding(true)
    setMsg(null)
    try {
      const created = (await api('POST', '/api/reminders', {
        title: t,
        due_date: due,
        related,
        notes,
      })) as Reminder
      setItems(prev => [...prev, created])
      setTitle('')
      setRelated('')
      setNotes('')
      setDue(addDays(todayISO(), 14))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not save the reminder.')
    }
    setAdding(false)
  }

  async function patch(id: string, updates: Record<string, unknown>) {
    setBusyId(id)
    setMsg(null)
    try {
      await api('PATCH', '/api/reminders', { id, ...updates })
      setItems(prev => prev.map(r => (r.id === id ? ({ ...r, ...updates } as Reminder) : r)))
      return true
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not update the reminder.')
      return false
    } finally {
      setBusyId(null)
    }
  }

  async function remove(r: Reminder) {
    if (!window.confirm(`Delete "${r.title}"? This cannot be undone.`)) return
    setBusyId(r.id)
    setMsg(null)
    try {
      await api('DELETE', `/api/reminders?id=${encodeURIComponent(r.id)}`)
      setItems(prev => prev.filter(x => x.id !== r.id))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not delete the reminder.')
    }
    setBusyId(null)
  }

  function startEdit(r: Reminder) {
    setEditId(r.id)
    setETitle(r.title)
    setEDue(r.due_date)
    setERelated(r.related || '')
    setENotes(r.notes || '')
  }

  async function saveEdit(id: string) {
    if (!eTitle.trim()) {
      setMsg('The title cannot be empty.')
      return
    }
    const ok = await patch(id, { title: eTitle.trim(), due_date: eDue, related: eRelated.trim() || null, notes: eNotes.trim() || null })
    if (ok) setEditId(null)
  }

  const today = todayISO()
  const open = items.filter(r => !r.completed_date)
  const done = items
    .filter(r => r.completed_date)
    .sort((a, b) => (b.completed_date || '').localeCompare(a.completed_date || ''))
    .slice(0, 20)
  const overdue = open.filter(r => daysBetween(today, r.due_date) < 0)
  const soon = open.filter(r => {
    const d = daysBetween(today, r.due_date)
    return d >= 0 && d <= 7
  })
  const later = open.filter(r => daysBetween(today, r.due_date) > 7)

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontFamily: BODY_FONT,
    fontSize: '18px',
    padding: '12px 10px',
    border: `2px solid ${C.ink}`,
    borderRadius: '8px',
    background: C.panel,
    color: C.ink,
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, margin: '12px 0 4px' }
  const btn = (primary = false): React.CSSProperties => ({
    fontFamily: BODY_FONT,
    fontSize: '16px',
    fontWeight: 600,
    padding: '10px 14px',
    borderRadius: '8px',
    border: `2px solid ${primary ? C.accent : C.ink}`,
    background: primary ? C.accent : C.panel,
    color: primary ? C.accentInk : C.ink,
    cursor: 'pointer',
    minHeight: '44px',
  })

  function renderCard(r: Reminder, state: 'overdue' | 'soon' | 'later' | 'done') {
    const editing = editId === r.id
    const busy = busyId === r.id
    const tag = state === 'overdue' ? 'OVERDUE' : state === 'soon' ? 'DUE SOON' : state === 'later' ? 'LATER' : 'DONE'
    const bg = state === 'overdue' ? C.overdueBg : state === 'soon' ? C.soonBg : C.panel
    const border = state === 'overdue' ? C.overdueInk : state === 'soon' ? C.soonInk : C.line

    return (
      <div
        key={r.id}
        style={{ background: bg, border: `2px solid ${border}`, borderRadius: '10px', padding: '12px', margin: '10px 0' }}
      >
        {!editing && (
          <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: HEAD_FONT,
                  fontSize: '14px',
                  fontWeight: 700,
                  border: `2px solid ${border}`,
                  borderRadius: '6px',
                  padding: '1px 7px',
                  color: state === 'overdue' ? C.overdueInk : state === 'soon' ? C.soonInk : C.muted,
                }}
              >
                {tag}
              </span>
              <span
                style={{
                  fontFamily: HEAD_FONT,
                  fontSize: '22px',
                  fontWeight: 700,
                  lineHeight: 1.15,
                  textDecoration: state === 'done' ? 'line-through' : 'none',
                }}
              >
                {r.title}
              </span>
            </div>
            <div style={{ fontSize: '16px', marginTop: '4px' }}>
              {state === 'done' && r.completed_date ? `Done ${niceDate(r.completed_date)} (was due ${niceDate(r.due_date)})` : dueText(r, today)}
            </div>
            {r.related && <div style={{ fontSize: '15px', color: C.muted, marginTop: '2px' }}>For: {r.related}</div>}
            {r.notes && <div style={{ fontSize: '15px', color: C.muted, marginTop: '4px', whiteSpace: 'pre-wrap' }}>{r.notes}</div>}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              {state !== 'done' ? (
                <>
                  <button type="button" disabled={busy} style={btn(true)} onClick={() => patch(r.id, { completed_date: today })}>
                    Done
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    style={btn()}
                    onClick={() => patch(r.id, { due_date: addDays(r.due_date < today ? today : r.due_date, 7) })}
                  >
                    Snooze 1 week
                  </button>
                </>
              ) : (
                <button type="button" disabled={busy} style={btn()} onClick={() => patch(r.id, { completed_date: null })}>
                  Reopen
                </button>
              )}
              <button type="button" disabled={busy} style={btn()} onClick={() => startEdit(r)}>
                Edit
              </button>
              <button type="button" disabled={busy} style={btn()} onClick={() => remove(r)}>
                Delete
              </button>
            </div>
          </>
        )}

        {editing && (
          <>
            <label style={labelStyle} htmlFor={`et-${r.id}`}>
              Title
            </label>
            <input id={`et-${r.id}`} style={inputStyle} value={eTitle} onChange={e => setETitle(e.target.value)} />
            <label style={labelStyle} htmlFor={`ed-${r.id}`}>
              Due date
            </label>
            <input id={`ed-${r.id}`} type="date" style={inputStyle} value={eDue} onChange={e => setEDue(e.target.value)} />
            <label style={labelStyle} htmlFor={`er-${r.id}`}>
              For (tree, tubestock or task)
            </label>
            <input id={`er-${r.id}`} style={inputStyle} value={eRelated} onChange={e => setERelated(e.target.value)} />
            <label style={labelStyle} htmlFor={`en-${r.id}`}>
              Notes
            </label>
            <textarea
              id={`en-${r.id}`}
              style={{ ...inputStyle, minHeight: '80px' }}
              value={eNotes}
              onChange={e => setENotes(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button type="button" disabled={busy} style={btn(true)} onClick={() => saveEdit(r.id)}>
                Save
              </button>
              <button type="button" style={btn()} onClick={() => setEditId(null)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  function section(titleText: string, list: Reminder[], state: 'overdue' | 'soon' | 'later', emptyText: string) {
    return (
      <div>
        <h2
          style={{
            fontFamily: HEAD_FONT,
            fontSize: '22px',
            fontWeight: 700,
            margin: '22px 0 4px',
            paddingBottom: '4px',
            borderBottom: `2px solid ${C.ink}`,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{titleText}</span>
          <span style={{ fontWeight: 500, color: C.muted }}>{list.length}</span>
        </h2>
        {list.length === 0 && <p style={{ color: C.muted, margin: '8px 0' }}>{emptyText}</p>}
        {list.map(r => renderCard(r, state))}
      </div>
    )
  }

  return (
    <main
      style={{
        background: C.bg,
        color: C.ink,
        fontFamily: BODY_FONT,
        fontSize: '18px',
        lineHeight: 1.35,
        minHeight: '100vh',
        margin: 0,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap');
        main button:focus-visible, main input:focus-visible, main textarea:focus-visible { outline: 3px solid ${C.accent}; outline-offset: 2px; }
      `}</style>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '14px 14px 48px' }}>
        <a href="/" style={{ fontSize: '13px', color: C.muted, textDecoration: 'none' }}>
          &larr; Admin Home
        </a>
        <h1 style={{ fontFamily: HEAD_FONT, fontSize: '28px', lineHeight: 1.1, margin: '4px 0 6px', fontWeight: 700 }}>Reminders</h1>
        <p style={{ margin: '0 0 8px', color: C.muted, fontSize: '15px' }}>
          Open reminders show in Overdue and Due Soon on the dashboard.
        </p>

        <div style={{ background: C.panel, border: `2px solid ${C.line}`, borderRadius: '10px', padding: '12px' }}>
          <h2 style={{ fontFamily: HEAD_FONT, fontSize: '20px', margin: '0 0 2px', fontWeight: 700 }}>Add a reminder</h2>

          <label style={labelStyle} htmlFor="rem-title">
            What needs doing
          </label>
          <input
            id="rem-title"
            style={inputStyle}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Photo of the wire scar"
          />

          <label style={labelStyle} htmlFor="rem-due">
            Due date
          </label>
          <input id="rem-due" type="date" style={inputStyle} value={due} onChange={e => setDue(e.target.value)} />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <button type="button" style={btn()} onClick={() => setDue(addDays(todayISO(), 7))}>
              1 week
            </button>
            <button type="button" style={btn()} onClick={() => setDue(addDays(todayISO(), 14))}>
              2 weeks
            </button>
            <button type="button" style={btn()} onClick={() => setDue(addDays(todayISO(), 30))}>
              1 month
            </button>
          </div>
          <div style={{ fontSize: '15px', color: C.muted, marginTop: '6px' }}>Selected: {due ? niceDate(due) : 'no date'}</div>

          <label style={labelStyle} htmlFor="rem-related">
            For (optional: tree, tubestock or task)
          </label>
          <input
            id="rem-related"
            style={inputStyle}
            value={related}
            onChange={e => setRelated(e.target.value)}
            placeholder="e.g. TS0003, Research Task 8"
          />

          <label style={labelStyle} htmlFor="rem-notes">
            Notes (optional)
          </label>
          <textarea id="rem-notes" style={{ ...inputStyle, minHeight: '70px' }} value={notes} onChange={e => setNotes(e.target.value)} />

          <div style={{ marginTop: '12px' }}>
            <button type="button" style={btn(true)} disabled={adding} onClick={addReminder}>
              {adding ? 'Saving...' : 'Add reminder'}
            </button>
          </div>
        </div>

        {msg && (
          <div
            role="alert"
            style={{
              margin: '12px 0 0',
              padding: '10px 12px',
              borderRadius: '8px',
              border: `2px solid ${C.err}`,
              background: C.panel,
              color: C.err,
              fontWeight: 600,
            }}
          >
            Problem: {msg}
          </div>
        )}

        {loading && <p style={{ color: C.muted }}>Loading...</p>}
        {loadError && (
          <p style={{ color: C.err, fontWeight: 600 }}>
            Problem: {loadError}{' '}
            <button type="button" style={btn()} onClick={load}>
              Try again
            </button>
          </p>
        )}

        {!loading && !loadError && (
          <>
            {section('Overdue', overdue, 'overdue', 'Nothing overdue.')}
            {section('Due in the next 7 days', soon, 'soon', 'Nothing due in the next 7 days.')}
            {section('Later', later, 'later', 'Nothing scheduled further out.')}

            <details style={{ marginTop: '24px' }}>
              <summary style={{ fontFamily: HEAD_FONT, fontSize: '20px', fontWeight: 700, cursor: 'pointer' }}>
                Done ({done.length}, most recent 20)
              </summary>
              {done.length === 0 && <p style={{ color: C.muted }}>Nothing completed yet.</p>}
              {done.map(r => renderCard(r, 'done'))}
            </details>
          </>
        )}
      </div>
    </main>
  )
}
