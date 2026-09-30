'use client'

// app/fertiliser-walk/page.tsx
//
// Phone walk-round for feeding plants. Pick the fertiliser in the bucket and
// the page lists every tree (T#) and tubestock batch (TS#) last fed with it,
// grouped by location. Tap a plant when it has been fed:
//   - trees: writes fertiliser_used + last_fertilised on the collection row
//     (PATCH /api/collection, same route the rest of the admin app uses)
//   - tubestock: appends a dated line to growing_on_notes
//     (PATCH /api/tubestock) -- tubestock has no fertiliser date column
// Tap a plant marked Done to undo it.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Product = { key: string; label: string; write: string; re: RegExp | null }

type Plant = {
  key: string // 'T151' or 'TS0003'
  kind: 'tree' | 'tube'
  id: string | number // collection_id (uuid) or tubestock id
  ident: string
  num: number
  name: string
  loc: string
  qty: number
  date: string // last fed, yyyy-mm-dd, or ''
  rec: string // fertiliser text as recorded
  notes: string // tubestock growing_on_notes
  baseKeys: string[] // which fertiliser lists this plant belongs to (fixed at load)
}

type UndoEntry = { rec: string; date: string }

const PRODUCTS: Product[] = [
  { key: 'bt', label: 'Neutrog Bush Tucker', write: 'Neutrog Bush Tucker', re: /bush tucker/i },
  { key: 'sm', label: 'Seamungus', write: 'Seamungus', re: /seamungus/i },
  { key: 'cc', label: 'Charlie Carp', write: 'Charlie Carp', re: /charlie carp/i },
  { key: 'pf', label: 'Powerfeed / Seasol', write: 'Seasol PowerFeed', re: /power ?feed|seasol/i },
  { key: 'dl', label: 'Dynamic Lifter', write: 'Dynamic Lifter', re: /dynamic lifter/i },
  { key: 'os', label: 'Osmocote', write: 'Osmocote', re: /osmocote/i },
  { key: 'rg', label: 'Richgro', write: 'Richgro', re: /richgro/i },
  { key: 'oth', label: 'Other / unspecific', write: '', re: null },
  { key: 'none', label: 'Nothing recorded', write: '', re: null },
]

const REAL_PRODUCTS = PRODUCTS.filter(p => p.re !== null)

const LOC_ORDER = ['Courtyard', 'Shadehouse', 'Rear Garden', 'Patio', 'Carport', 'Hospital', 'Water Tray']

// Poor fit for Bush Tucker: nitrogen-fixing legumes, pines, Toona, E. pauciflora.
const CAUTION_RE = /^(Acacia|Hovea|Pinus|Toona) |^Eucalyptus pauciflora/

const C = {
  bg: '#eef1ec',
  panel: '#ffffff',
  ink: '#16241b',
  muted: '#4a5a50',
  line: '#b9c4bb',
  accent: '#1c4fa8',
  doneBg: '#dfe8f7',
  warnBg: '#fff1c9',
  warnInk: '#5a3f00',
  err: '#9b1c1c',
}

const HEAD_FONT = '"Barlow Semi Condensed", "Arial Narrow", "Helvetica Neue", Arial, sans-serif'
const BODY_FONT = '"Barlow", "Helvetica Neue", Arial, sans-serif'

const UNDO_KEY = 'fw_undo_v1'
const PRODUCT_KEY = 'fw_product'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Local date, not toISOString(): in Brisbane (UTC+10) toISOString() gives
// yesterday's date before 10am, which would stamp morning walks a day early.
function todayLocal(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function daysSince(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const [ty, tm, td] = todayLocal().split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000)
}

function niceDate(iso: string): string {
  const p = iso.split('-')
  return `${Number(p[2])} ${MONTHS[Number(p[1]) - 1]}`
}

function fedText(p: Plant): string {
  if (!p.date) return 'No fed date recorded'
  const d = daysSince(p.date)
  if (d <= 0) return 'Fed today'
  if (d === 1) return `Last fed yesterday (${niceDate(p.date)})`
  return `Last fed ${niceDate(p.date)}, ${d} days ago`
}

function keysFor(rec: string): string[] {
  const keys = PRODUCTS.filter(p => p.re && p.re.test(rec)).map(p => p.key)
  if (keys.length) return keys
  return [rec.trim() ? 'oth' : 'none']
}

// Latest "YYYY-MM-DD: fertilised with X." line in a tubestock's growing_on_notes.
function lastFeedFromNotes(notes: string): { date: string; rec: string } {
  const re = /(\d{4}-\d{2}-\d{2}): fertilised with ([^.\n]+)\./g
  let date = ''
  let rec = ''
  let m: RegExpExecArray | null = re.exec(notes)
  while (m) {
    if (m[1] >= date) {
      date = m[1]
      rec = m[2].trim()
    }
    m = re.exec(notes)
  }
  return { date, rec }
}

function readUndo(): Record<string, UndoEntry> {
  try {
    return JSON.parse(localStorage.getItem(UNDO_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function writeUndo(map: Record<string, UndoEntry>) {
  try {
    localStorage.setItem(UNDO_KEY, JSON.stringify(map))
  } catch {
    // storage full or blocked: undo just will not be available after a reload
  }
}

async function fetchNames(table: 'species' | 'variants', nums: number[]): Promise<Record<number, string>> {
  const out: Record<number, string> = {}
  for (let i = 0; i < nums.length; i += 100) {
    const chunk = nums.slice(i, i + 100)
    if (table === 'species') {
      const { data } = await supabase.from('species').select('sp_no, species').in('sp_no', chunk)
      for (const r of data || []) out[r.sp_no] = r.species
    } else {
      const { data } = await supabase.from('variants').select('sp_no, variant_name').in('sp_no', chunk)
      for (const r of data || []) out[r.sp_no] = r.variant_name
    }
  }
  return out
}

async function patchJson(url: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Save failed (${err.error || res.status}). Nothing was changed.`)
  }
}

export default function FertiliserWalkPage() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fert, setFert] = useState('bt')
  const [logKey, setLogKey] = useState('bt')
  const [order, setOrder] = useState<'loc' | 'old'>('loc')
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRODUCT_KEY)
      if (saved && PRODUCTS.some(p => p.key === saved)) setFert(saved)
    } catch {
      // ignore
    }
    load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [cRes, tRes] = await Promise.all([fetch('/api/collection'), fetch('/api/tubestock')])
      if (!cRes.ok || !tRes.ok) {
        setLoadError('Could not load your plants. Check your signal and try again.')
        setLoading(false)
        return
      }
      const cRows: any[] = await cRes.json()
      const tRows: any[] = await tRes.json()

      const list: Plant[] = []

      for (const r of cRows || []) {
        if (r.in_collection !== true) continue
        if (r.tree_number == null) continue
        const loc = String(r.location || '').trim()
        if (loc.toLowerCase() === 'deceased' || String(r.status || '').toLowerCase() === 'deceased') continue
        const num = Number(r.tree_number)
        let name = String(r.display_name || r.tree_name || '').trim()
        const suffix = ` ${num}`
        if (name.endsWith(suffix)) name = name.slice(0, -suffix.length)
        const rec = String(r.fertiliser_used || '').trim()
        list.push({
          key: `T${num}`,
          kind: 'tree',
          id: r.collection_id,
          ident: `T${num}`,
          num,
          name: name || 'Unnamed plant',
          loc: loc || 'No location',
          qty: 1,
          date: r.last_fertilised ? String(r.last_fertilised).slice(0, 10) : '',
          rec,
          notes: '',
          baseKeys: keysFor(rec),
        })
      }

      const growing = (tRows || []).filter(r => r.status === 'growing_on')
      const spNos = [...new Set(growing.map(r => r.sp_no).filter(Boolean))] as number[]
      const vNos = [...new Set(growing.map(r => r.variant_sp_no).filter(Boolean))] as number[]
      const [spNames, vNames] = await Promise.all([fetchNames('species', spNos), fetchNames('variants', vNos)])

      for (const r of growing) {
        const notes = String(r.growing_on_notes || '')
        const feed = lastFeedFromNotes(notes)
        const ident = String(r.tubestock_number || `TS#${r.id}`)
        const digits = /(\d+)/.exec(ident)
        const name =
          (r.variant_sp_no && vNames[r.variant_sp_no]) ||
          (r.sp_no && spNames[r.sp_no]) ||
          r.species_name_text ||
          'Unlinked species'
        list.push({
          key: ident,
          kind: 'tube',
          id: r.id,
          ident,
          num: digits ? Number(digits[1]) : 0,
          name,
          loc: 'Tubestock',
          qty: Number(r.quantity) || 1,
          date: feed.date,
          rec: feed.rec,
          notes,
          baseKeys: keysFor(feed.rec),
        })
      }

      setPlants(list)
    } catch {
      setLoadError('Could not load your plants. Check your signal and try again.')
    }
    setLoading(false)
  }

  const selected = PRODUCTS.find(p => p.key === fert) || PRODUCTS[0]
  // The product actually written when a plant is ticked. In the "Other" and
  // "Nothing recorded" lists there is no product to write, so the second
  // dropdown chooses one.
  const prod: Product | null = selected.re ? selected : REAL_PRODUCTS.find(p => p.key === logKey) || null

  const today = todayLocal()

  function isDone(p: Plant, pr: Product): boolean {
    return p.date === today && !!pr.re && pr.re.test(p.rec)
  }

  function patchPlant(key: string, patch: Partial<Plant>) {
    setPlants(prev =>
      prev.map(p => {
        if (p.key !== key) return p
        const merged = { ...p, ...patch }
        return merged
      })
    )
  }

  function valueToWrite(p: Plant, pr: Product): string {
    // Keep a specific existing label (e.g. "Richgrow Fruit and Citrus") when it
    // is a single product matching the one being used; otherwise use the
    // standard product name.
    if ((pr.key === 'os' || pr.key === 'rg') && p.rec) {
      const k = keysFor(p.rec)
      if (k.length === 1 && k[0] === pr.key) return p.rec
    }
    return pr.write
  }

  async function mark(p: Plant, pr: Product) {
    if (p.kind === 'tree') {
      const newRec = valueToWrite(p, pr)
      await patchJson('/api/collection', {
        collection_id: p.id,
        fertiliser_used: newRec,
        last_fertilised: today,
      })
      const undo = readUndo()
      undo[`${p.id}:${today}`] = { rec: p.rec, date: p.date }
      writeUndo(undo)
      patchPlant(p.key, { rec: newRec, date: today })
    } else {
      const line = `${today}: fertilised with ${pr.write}.`
      const base = p.notes.replace(/\s+$/, '')
      const newNotes = base ? `${base}\n${line}` : line
      await patchJson('/api/tubestock', { id: p.id, growing_on_notes: newNotes })
      const feed = lastFeedFromNotes(newNotes)
      patchPlant(p.key, { notes: newNotes, date: feed.date, rec: feed.rec })
    }
  }

  async function undo(p: Plant, pr: Product) {
    if (p.kind === 'tree') {
      const map = readUndo()
      const prev = map[`${p.id}:${today}`]
      if (!prev) {
        throw new Error(
          `${p.ident} was fed earlier, not from this phone, so there is nothing to undo here. Edit it on the collection page if it is wrong.`
        )
      }
      await patchJson('/api/collection', {
        collection_id: p.id,
        fertiliser_used: prev.rec || null,
        last_fertilised: prev.date || null,
      })
      delete map[`${p.id}:${today}`]
      writeUndo(map)
      patchPlant(p.key, { rec: prev.rec, date: prev.date })
    } else {
      const line = `${today}: fertilised with ${pr.write}.`
      const remaining = p.notes
        .split('\n')
        .filter(l => l.trim() !== line)
        .join('\n')
        .replace(/\s+$/, '')
      await patchJson('/api/tubestock', { id: p.id, growing_on_notes: remaining || null })
      const feed = lastFeedFromNotes(remaining)
      patchPlant(p.key, { notes: remaining, date: feed.date, rec: feed.rec })
    }
  }

  async function toggle(p: Plant) {
    if (!prod) {
      setMsg('Choose which fertiliser you are using in the "Log as" box first.')
      return
    }
    if (busy.has(p.key)) return
    setMsg(null)
    setBusy(prev => new Set(prev).add(p.key))
    try {
      if (isDone(p, prod)) await undo(p, prod)
      else await mark(p, prod)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Something went wrong. Nothing was changed.')
    }
    setBusy(prev => {
      const n = new Set(prev)
      n.delete(p.key)
      return n
    })
  }

  function chooseProduct(key: string) {
    setFert(key)
    setMsg(null)
    try {
      localStorage.setItem(PRODUCT_KEY, key)
    } catch {
      // ignore
    }
  }

  const list = plants.filter(p => p.baseKeys.includes(selected.key))
  const doneCount = prod ? list.filter(p => isDone(p, prod)).length : 0

  const groups: { title: string; items: Plant[] }[] = []
  if (order === 'loc') {
    const locs = [...new Set(list.map(p => p.loc))]
    locs.sort((a, b) => {
      if (a === 'Tubestock') return 1
      if (b === 'Tubestock') return -1
      const ia = LOC_ORDER.indexOf(a)
      const ib = LOC_ORDER.indexOf(b)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b)
    })
    for (const loc of locs) {
      const items = list.filter(p => p.loc === loc).sort((a, b) => a.num - b.num)
      groups.push({ title: loc, items })
    }
  } else {
    const items = list.slice().sort((a, b) => {
      const ad = a.date || '0000-00-00'
      const bd = b.date || '0000-00-00'
      if (ad !== bd) return ad < bd ? -1 : 1
      return a.num - b.num
    })
    groups.push({ title: '', items })
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    fontFamily: BODY_FONT,
    fontSize: '20px',
    padding: '14px 12px',
    border: `2px solid ${C.ink}`,
    borderRadius: '8px',
    background: C.panel,
    color: C.ink,
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, margin: '10px 0 4px' }

  function renderRow(p: Plant, showLoc: boolean) {
    const done = !!prod && isDone(p, prod)
    const working = busy.has(p.key)
    const recNote =
      p.rec && (!prod || p.rec.toLowerCase() !== prod.write.toLowerCase())
        ? `Recorded as: ${p.rec.length > 80 ? p.rec.slice(0, 80) + '...' : p.rec}`
        : ''
    const caution = selected.key === 'bt' && CAUTION_RE.test(`${p.name} `)
    return (
      <button
        key={p.key}
        type="button"
        onClick={() => toggle(p)}
        aria-pressed={done}
        disabled={working}
        style={{
          display: 'grid',
          gridTemplateColumns: '78px 1fr auto',
          gap: '10px',
          alignItems: 'center',
          width: '100%',
          textAlign: 'left',
          fontFamily: BODY_FONT,
          fontSize: '18px',
          color: C.ink,
          background: done ? C.doneBg : C.panel,
          border: `2px solid ${done ? C.accent : C.line}`,
          borderRadius: '10px',
          padding: '10px 12px',
          margin: '8px 0',
          minHeight: '64px',
          cursor: working ? 'wait' : 'pointer',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontFamily: HEAD_FONT,
            fontSize: '30px',
            fontWeight: 700,
            lineHeight: 1,
            textDecoration: done ? 'line-through' : 'none',
            textDecorationThickness: '2px',
          }}
        >
          {p.ident}
        </div>
        <div>
          <div style={{ fontStyle: 'italic', fontWeight: 500 }}>
            {p.name}
            {p.kind === 'tube' ? `  x${p.qty}` : ''}
          </div>
          <div style={{ fontSize: '15px', color: C.muted, marginTop: '2px' }}>
            {fedText(p)}
            {showLoc && p.kind === 'tree' ? ` - ${p.loc}` : ''}
          </div>
          {done && <div style={{ fontSize: '14px', color: C.muted, marginTop: '2px' }}>Tap again to undo</div>}
          {recNote && <div style={{ fontSize: '14px', color: C.muted, marginTop: '2px' }}>{recNote}</div>}
          {caution && (
            <div
              style={{
                display: 'inline-block',
                marginTop: '4px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: C.warnBg,
                color: C.warnInk,
                fontSize: '14px',
                fontWeight: 600,
                border: `2px solid ${C.warnInk}`,
              }}
            >
              Caution: poor fit for Bush Tucker
            </div>
          )}
        </div>
        <div
          style={{
            fontFamily: HEAD_FONT,
            fontWeight: 700,
            fontSize: '18px',
            minWidth: '68px',
            textAlign: 'center',
            padding: '8px 10px',
            borderRadius: '8px',
            border: `2px solid ${done ? C.accent : C.ink}`,
            background: done ? C.accent : 'transparent',
            color: done ? '#ffffff' : C.ink,
          }}
        >
          {working ? 'Saving' : done ? 'Done' : 'To do'}
        </div>
      </button>
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
        .fw-focus:focus-visible { outline: 3px solid ${C.accent}; outline-offset: 2px; }
        button.fw-row:focus-visible { outline: 3px solid ${C.accent}; outline-offset: 2px; }
      `}</style>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '14px 14px 40px' }}>
        <a href="/" style={{ fontSize: '13px', color: C.muted, textDecoration: 'none' }}>
          &larr; Admin Home
        </a>
        <h1 style={{ fontFamily: HEAD_FONT, fontSize: '28px', lineHeight: 1.1, margin: '4px 0 12px', fontWeight: 700 }}>
          Fertiliser walk-round
        </h1>

        <label htmlFor="fw-fert" style={labelStyle}>
          Fertiliser in the bucket
        </label>
        <select
          id="fw-fert"
          className="fw-focus"
          value={fert}
          onChange={e => chooseProduct(e.target.value)}
          style={selectStyle}
        >
          {PRODUCTS.map(p => {
            const n = plants.filter(x => x.baseKeys.includes(p.key)).length
            if (!n && p.key !== fert) return null
            return (
              <option key={p.key} value={p.key}>
                {p.label} ({n})
              </option>
            )
          })}
        </select>

        {!selected.re && (
          <>
            <label htmlFor="fw-log" style={labelStyle}>
              Log as (what you are feeding these with)
            </label>
            <select
              id="fw-log"
              className="fw-focus"
              value={logKey}
              onChange={e => setLogKey(e.target.value)}
              style={selectStyle}
            >
              {REAL_PRODUCTS.map(p => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </>
        )}

        <label htmlFor="fw-order" style={labelStyle}>
          Order
        </label>
        <select
          id="fw-order"
          className="fw-focus"
          value={order}
          onChange={e => setOrder(e.target.value as 'loc' | 'old')}
          style={selectStyle}
        >
          <option value="loc">By location</option>
          <option value="old">Longest since fed first</option>
        </select>

        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            background: C.bg,
            padding: '8px 0',
            marginTop: '6px',
            borderBottom: `2px solid ${C.line}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div style={{ fontFamily: HEAD_FONT, fontSize: '22px', fontWeight: 600 }} aria-live="polite">
            {loading ? 'Loading...' : `${doneCount} of ${list.length} done`}
          </div>
          <button
            type="button"
            className="fw-focus"
            onClick={load}
            disabled={loading}
            style={{
              fontFamily: BODY_FONT,
              fontSize: '16px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: `2px solid ${C.line}`,
              background: C.panel,
              color: C.ink,
            }}
          >
            Reload
          </button>
        </div>

        {msg && (
          <div
            role="alert"
            style={{
              margin: '10px 0 0',
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

        {loadError && (
          <p style={{ color: C.err, fontWeight: 600, padding: '16px 0' }}>Problem: {loadError}</p>
        )}

        {!loading && !loadError && list.length === 0 && (
          <p style={{ color: C.muted, padding: '20px 4px' }}>No plants recorded for this fertiliser.</p>
        )}

        {groups.map(g => (
          <div key={g.title || 'all'}>
            {g.title && (
              <h2
                style={{
                  fontFamily: HEAD_FONT,
                  fontSize: '22px',
                  fontWeight: 700,
                  margin: '18px 0 6px',
                  paddingBottom: '4px',
                  borderBottom: `2px solid ${C.ink}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{g.title}</span>
                <span style={{ fontWeight: 500, color: C.muted }}>
                  {g.items.length} {g.items.length === 1 ? 'record' : 'records'}
                </span>
              </h2>
            )}
            {g.items.map(p => renderRow(p, order === 'old'))}
          </div>
        ))}

        <p style={{ marginTop: '26px', fontSize: '14px', color: C.muted, borderTop: `2px solid ${C.line}`, paddingTop: '10px' }}>
          Fertiliser names are grouped from what is typed in each record, so a plant recorded with two products
          appears under both. Ticking a tree saves the fertiliser and today&apos;s date to its record straight away.
          Ticking tubestock adds a dated line to its growing-on notes. A ticked plant stays in its list until you
          reload, so you can still tap it again to undo.
        </p>
      </div>
    </main>
  )
}
