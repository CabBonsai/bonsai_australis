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
//
// Species with a feeding interval set (fertilisation.feed_interval_days, e.g. 56 for
// every 8 weeks) show when they are next due, and appear under "Due for feeding".
//
// Trees: the due date comes from the open 'fertilise' row in care_schedule (the same
// row the collection page shows and lets you defer). Ticking a tree completes that row
// and adds the next one at today + the species interval (30 days if none is set).
// Tubestock has no care_schedule rows, so it still works out due dates from the interval.

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
  spNo: number | null // species number, used to look up the favourite fertiliser
  fav: string // key of the species' favourite fertiliser, or '' when none is recorded
  intervalDays: number | null // feeding interval in days from the species record, or null
  careId: number | null // open 'fertilise' care_schedule row for a tree, or null
  careDue: string // that row's due date, yyyy-mm-dd, or ''
}

type UndoEntry = { rec: string; date: string; doneId?: number; doneDue?: string; newId?: number }

const PRODUCTS: Product[] = [
  { key: 'due', label: 'Due for feeding (by schedule)', write: '', re: null },
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
const MIX_KEY = 'fw_mix'

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

// Favourite fertiliser and feeding interval per species, from the species
// fertilisation record. The favourite is the first product named in
// recommended_products and is only used for researched species (Provisional or
// Verified), so generic default text is never shown as a favourite. The interval
// (feed_interval_days) is an owner setting and is used whenever it is present.
type SpeciesFeed = { fav: string; interval: number | null }

async function fetchFavourites(spNos: number[]): Promise<Record<number, SpeciesFeed>> {
  const out: Record<number, SpeciesFeed> = {}
  try {
    for (let i = 0; i < spNos.length; i += 100) {
      const chunk = spNos.slice(i, i + 100)
      const { data } = await supabase
        .from('fertilisation')
        .select('sp_no, recommended_products, research_status, feed_interval_days')
        .in('sp_no', chunk)
      for (const r of data || []) {
        let best = ''
        if (r.research_status === 'Provisional' || r.research_status === 'Verified') {
          const text = String(r.recommended_products || '')
          let bestAt = Infinity
          for (const pr of REAL_PRODUCTS) {
            const m = pr.re ? pr.re.exec(text) : null
            if (m && m.index < bestAt) {
              bestAt = m.index
              best = pr.key
            }
          }
        }
        const interval = r.feed_interval_days != null && Number(r.feed_interval_days) > 0 ? Number(r.feed_interval_days) : null
        if (best || interval) out[r.sp_no] = { fav: best, interval }
      }
    }
  } catch {
    // favourites and schedules are a nicety: if they cannot load, the walk works without them
  }
  return out
}

// Days until the next feed is due: negative = overdue, 0 = due today,
// null = no schedule for this plant. A plant never fed counts as due now.
function daysToDue(p: Plant): number | null {
  if (p.careDue) return -daysSince(p.careDue)
  if (!p.intervalDays) return null
  if (!p.date) return 0
  return p.intervalDays - daysSince(p.date)
}

function dueText(p: Plant): string {
  const d = daysToDue(p)
  if (d === null) return ''
  const iv = p.intervalDays
  const every = !iv ? 'collection schedule' : iv % 7 === 0 ? `every ${iv / 7} weeks` : `every ${iv} days`
  if (p.careDue) {
    if (d < 0) return `Overdue by ${-d} day${-d === 1 ? '' : 's'} (due ${niceDate(p.careDue)}, ${every})`
    if (d === 0) return `Due today (${every})`
    return `Next feed due ${niceDate(p.careDue)} (in ${d} day${d === 1 ? '' : 's'}, ${every})`
  }
  if (!p.date) return `Feeding due now: never fed (${every})`
  if (d < 0) return `Overdue by ${-d} day${-d === 1 ? '' : 's'} (${every})`
  if (d === 0) return `Due today (${every})`
  const [y, m, day] = p.date.split('-').map(Number)
  const due = new Date(Date.UTC(y, m - 1, day + (p.intervalDays || 0)))
  return `Next feed due ${due.getUTCDate()} ${MONTHS[due.getUTCMonth()]} (in ${d} day${d === 1 ? '' : 's'}, ${every})`
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
  // Products logged when a plant is ticked. Tick several for a mix (for example a
  // slow-release pellet plus a liquid plus Seasol) and all are recorded together.
  const [mix, setMix] = useState<string[]>(['bt'])
  const [order, setOrder] = useState<'loc' | 'old' | 'due'>('loc')
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRODUCT_KEY)
      if (saved && PRODUCTS.some(p => p.key === saved)) setFert(saved)
      const savedMix = JSON.parse(localStorage.getItem(MIX_KEY) || '[]')
      if (Array.isArray(savedMix)) {
        const ok = savedMix.filter((k: unknown) => REAL_PRODUCTS.some(p => p.key === k)) as string[]
        if (ok.length) setMix(ok)
      }
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
          spNo: r.sp_no != null ? Number(r.sp_no) : null,
          fav: '',
          intervalDays: null,
          careId: null,
          careDue: '',
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
          spNo: r.sp_no != null ? Number(r.sp_no) : null,
          fav: '',
          intervalDays: null,
          careId: null,
          careDue: '',
        })
      }

      // Open fertilise rows from care_schedule: earliest per tree is that tree's due date.
      try {
        const cs = await fetch('/api/care-schedule?status=open&event_type=fertilise')
        if (cs.ok) {
          const rows: any[] = await cs.json()
          const byTree: Record<number, { id: number; due: string }> = {}
          for (const r of rows || []) {
            if (!r.due_date) continue
            const t = Number(r.tree_number)
            const due = String(r.due_date).slice(0, 10)
            if (!byTree[t] || due < byTree[t].due) byTree[t] = { id: r.id, due }
          }
          for (const pl of list) {
            if (pl.kind !== 'tree') continue
            const c = byTree[pl.num]
            if (c) {
              pl.careId = c.id
              pl.careDue = c.due
            }
          }
        }
      } catch {
        // without care_schedule the walk falls back to interval-based due dates
      }

      const favNos = [...new Set(list.map(pl => pl.spNo).filter((n): n is number => n != null))]
      const favs = await fetchFavourites(favNos)
      for (const pl of list) {
        const f = pl.spNo != null ? favs[pl.spNo] : undefined
        if (f) {
          pl.fav = f.fav
          pl.intervalDays = f.interval
        }
      }

      setPlants(list)
    } catch {
      setLoadError('Could not load your plants. Check your signal and try again.')
    }
    setLoading(false)
  }

  const selected = PRODUCTS.find(p => p.key === fert) || PRODUCTS[0]
  const mixProducts = REAL_PRODUCTS.filter(p => mix.includes(p.key))
  const mixLabel = mixProducts.map(p => p.write).join(', ')

  const today = todayLocal()

  // A plant counts as done when it was fed today with every product in the mix.
  function isDone(p: Plant): boolean {
    return (
      mixProducts.length > 0 &&
      p.date === today &&
      mixProducts.every(pr => !!pr.re && pr.re.test(p.rec))
    )
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

  async function mark(p: Plant) {
    if (p.kind === 'tree') {
      const newRec = mixProducts.length === 1 ? valueToWrite(p, mixProducts[0]) : mixLabel
      await patchJson('/api/collection', {
        collection_id: p.id,
        fertiliser_used: newRec,
        last_fertilised: today,
      })
      const entry: UndoEntry = { rec: p.rec, date: p.date }
      let nextId: number | null = p.careId
      let nextDue = p.careDue
      try {
        // Complete the open fertilise row and schedule the next one.
        if (p.careId != null) {
          await patchJson('/api/care-schedule', { id: p.careId, completed_date: today })
          entry.doneId = p.careId
          entry.doneDue = p.careDue
        }
        const iv = p.intervalDays && p.intervalDays > 0 ? p.intervalDays : 30
        const [y, m, d] = today.split('-').map(Number)
        const nd = new Date(Date.UTC(y, m - 1, d + iv))
        nextDue = `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, '0')}-${String(nd.getUTCDate()).padStart(2, '0')}`
        const res = await fetch('/api/care-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tree_number: p.num,
            event_type: 'fertilise',
            due_date: nextDue,
            notes: `Next feed after ${mixLabel} on ${today} (${iv} days)`,
          }),
        })
        if (!res.ok) throw new Error('Could not add the next feed to the collection schedule.')
        const created = await res.json()
        const newId = Array.isArray(created) ? created[0]?.id : created?.id
        if (newId != null) {
          entry.newId = newId
          nextId = newId
        }
      } catch (e) {
        const undoMap = readUndo()
        undoMap[`${p.id}:${today}`] = entry
        writeUndo(undoMap)
        patchPlant(p.key, { rec: newRec, date: today })
        throw new Error(
          `${p.ident} was marked fed, but the collection schedule was not fully updated (${e instanceof Error ? e.message : 'unknown error'}). Check its care events.`
        )
      }
      const undo = readUndo()
      undo[`${p.id}:${today}`] = entry
      writeUndo(undo)
      patchPlant(p.key, { rec: newRec, date: today, careId: nextId, careDue: nextDue })
    } else {
      const line = `${today}: fertilised with ${mixLabel}.`
      const base = p.notes.replace(/\s+$/, '')
      const newNotes = base ? `${base}\n${line}` : line
      await patchJson('/api/tubestock', { id: p.id, growing_on_notes: newNotes })
      const feed = lastFeedFromNotes(newNotes)
      patchPlant(p.key, { notes: newNotes, date: feed.date, rec: feed.rec })
    }
  }

  async function undo(p: Plant) {
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
      // Put the care schedule back: drop the row added on tick, reopen the completed one.
      if (prev.newId != null) {
        const del = await fetch(`/api/care-schedule?id=${prev.newId}`, { method: 'DELETE' })
        if (!del.ok) throw new Error('Could not remove the next feed row. Edit it in the collection.')
      }
      if (prev.doneId != null) {
        await patchJson('/api/care-schedule', { id: prev.doneId, completed_date: null })
      }
      delete map[`${p.id}:${today}`]
      writeUndo(map)
      patchPlant(p.key, {
        rec: prev.rec,
        date: prev.date,
        careId: prev.doneId ?? null,
        careDue: prev.doneDue ?? '',
      })
    } else {
      const remaining = p.notes
        .split('\n')
        .filter(l => {
          const m = /^(\d{4}-\d{2}-\d{2}): fertilised with ([^.\n]+)\.$/.exec(l.trim())
          if (!m || m[1] !== today) return true
          return !mixProducts.every(pr => !!pr.re && pr.re.test(m[2]))
        })
        .join('\n')
        .replace(/\s+$/, '')
      await patchJson('/api/tubestock', { id: p.id, growing_on_notes: remaining || null })
      const feed = lastFeedFromNotes(remaining)
      patchPlant(p.key, { notes: remaining, date: feed.date, rec: feed.rec })
    }
  }

  async function toggle(p: Plant) {
    if (!mixProducts.length) {
      setMsg('Tick at least one fertiliser under "Log as" first.')
      return
    }
    if (busy.has(p.key)) return
    setMsg(null)
    setBusy(prev => new Set(prev).add(p.key))
    try {
      if (isDone(p)) await undo(p)
      else await mark(p)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Something went wrong. Nothing was changed.')
    }
    setBusy(prev => {
      const n = new Set(prev)
      n.delete(p.key)
      return n
    })
  }

  function saveMix(next: string[]) {
    setMix(next)
    try {
      localStorage.setItem(MIX_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  function chooseProduct(key: string) {
    setFert(key)
    setMsg(null)
    try {
      localStorage.setItem(PRODUCT_KEY, key)
    } catch {
      // ignore
    }
    // Picking a real product resets the mix to just that product.
    if (REAL_PRODUCTS.some(p => p.key === key)) saveMix([key])
  }

  function toggleMix(key: string) {
    setMsg(null)
    saveMix(mix.includes(key) ? mix.filter(k => k !== key) : [...mix, key])
  }

  const list =
    selected.key === 'due'
      ? plants.filter(p => {
          const d = daysToDue(p)
          return (d !== null && d <= 0) || isDone(p)
        })
      : plants.filter(p => p.baseKeys.includes(selected.key))
  const doneCount = list.filter(p => isDone(p)).length

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
  } else if (order === 'due') {
    // Due now first (most overdue at the top), then not due yet (soonest first),
    // then plants with no feeding schedule. A plant ticked in this session stays
    // in the Due now group, at the end, so it can still be tapped again to undo.
    const dueKey = (p: Plant): number => (isDone(p) ? 100000 : (daysToDue(p) ?? 99999))
    const byDue = (a: Plant, b: Plant) => {
      const ak = dueKey(a)
      const bk = dueKey(b)
      if (ak !== bk) return ak - bk
      return a.num - b.num
    }
    const dueNow = list.filter(p => isDone(p) || (daysToDue(p) !== null && (daysToDue(p) as number) <= 0)).sort(byDue)
    const notYet = list.filter(p => !isDone(p) && daysToDue(p) !== null && (daysToDue(p) as number) > 0).sort(byDue)
    const noSchedule = list.filter(p => !isDone(p) && daysToDue(p) === null).sort((a, b) => a.num - b.num)
    if (dueNow.length) groups.push({ title: 'Due now', items: dueNow })
    if (notYet.length) groups.push({ title: 'Not due yet', items: notYet })
    if (noSchedule.length) groups.push({ title: 'No feeding schedule', items: noSchedule })
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
    const done = isDone(p)
    const working = busy.has(p.key)
    const recNote =
      p.rec && p.rec.toLowerCase() !== mixLabel.toLowerCase()
        ? `Recorded as: ${p.rec.length > 80 ? p.rec.slice(0, 80) + '...' : p.rec}`
        : ''
    const caution = mix.includes('bt') && CAUTION_RE.test(`${p.name} `)
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
          {dueText(p) && (
            <div style={{ fontSize: '14px', color: C.ink, marginTop: '2px', fontWeight: (daysToDue(p) ?? 1) <= 0 ? 700 : 400 }}>
              {dueText(p)}
            </div>
          )}
          {p.fav && (
            <div style={{ fontSize: '14px', color: C.muted, marginTop: '2px' }}>
              Favourite: {PRODUCTS.find(x => x.key === p.fav)?.label || ''}
            </div>
          )}
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
          Show plants last fed with
        </label>
        <select
          id="fw-fert"
          className="fw-focus"
          value={fert}
          onChange={e => chooseProduct(e.target.value)}
          style={selectStyle}
        >
          {PRODUCTS.map(p => {
            const n =
              p.key === 'due'
                ? plants.filter(x => { const d = daysToDue(x); return d !== null && d <= 0 }).length
                : plants.filter(x => x.baseKeys.includes(p.key)).length
            if (!n && p.key !== fert) return null
            return (
              <option key={p.key} value={p.key}>
                {p.label} ({n})
              </option>
            )
          })}
        </select>

        <fieldset style={{ margin: '14px 0 0', padding: '10px 12px', border: `2px solid ${C.ink}`, borderRadius: '8px', background: C.panel }}>
          <legend style={{ fontWeight: 600, padding: '0 6px' }}>Log as (tick everything in the bucket)</legend>
          {REAL_PRODUCTS.map(pr => (
            <label
              key={pr.key}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', margin: 0, fontWeight: 500, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                className="fw-focus"
                checked={mix.includes(pr.key)}
                onChange={() => toggleMix(pr.key)}
                style={{ width: '24px', height: '24px', flexShrink: 0 }}
              />
              <span>{pr.write}</span>
            </label>
          ))}
          <div style={{ marginTop: '6px', fontSize: '15px', color: C.muted }}>
            {mixProducts.length ? `Ticking a plant will record: ${mixLabel}` : 'Nothing ticked - tick at least one product.'}
          </div>
        </fieldset>

        <label htmlFor="fw-order" style={labelStyle}>
          Order
        </label>
        <select
          id="fw-order"
          className="fw-focus"
          value={order}
          onChange={e => setOrder(e.target.value as 'loc' | 'old' | 'due')}
          style={selectStyle}
        >
          <option value="loc">By location</option>
          <option value="old">Longest since fed first</option>
          <option value="due">Due now</option>
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
            {g.items.map(p => renderRow(p, order !== 'loc'))}
          </div>
        ))}

        <p style={{ marginTop: '26px', fontSize: '14px', color: C.muted, borderTop: `2px solid ${C.line}`, paddingTop: '10px' }}>
          Fertiliser names are grouped from what is typed in each record, so a plant recorded with two products
          appears under both. Tick several products under Log as to record a mix in one tap. Ticking a tree saves the fertiliser and today&apos;s date to its record straight away.
          Ticking tubestock adds a dated line to its growing-on notes. A ticked plant stays in its list until you
          reload, so you can still tap it again to undo.
        </p>
      </div>
    </main>
  )
}
