'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { readCollection } from '@/lib/collectionRead'
import { supabase } from '@/lib/supabase'
import OverdueCareRow, { CareEvent } from '../components/OverdueCareRow'

// Overdue tab: overdue tree care tasks (care_schedule) and overdue reminders.
// Moved off the main dashboard; the logic matches what the dashboard used.

function localISO(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function OverduePage() {
  const [trees, setTrees] = useState<any[]>([])
  const [careEvents, setCareEvents] = useState<any[]>([])
  const [reminders, setReminders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await readCollection({ in_collection: 'true', order: 'tree_number', asc: '1' })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const rows = data || []
    const spNos = [...new Set(rows.map((t: any) => t.sp_no).filter(Boolean))]
    const variantSpNos = [...new Set(rows.map((t: any) => t.variant_sp_no).filter(Boolean))]
    const speciesMap: Record<number, string> = {}
    const variantMap: Record<number, string> = {}

    if (spNos.length > 0) {
      const { data: spData } = await supabase.from('species').select('sp_no, species, common_name').in('sp_no', spNos)
      ;(spData || []).forEach((s: any) => {
        speciesMap[s.sp_no] = s.species + (s.common_name && s.common_name !== 'Unknown' ? ' — ' + s.common_name : '')
      })
    }
    if (variantSpNos.length > 0) {
      const { data: varData } = await supabase.from('variants').select('sp_no, variant_name, common_name').in('sp_no', variantSpNos)
      ;(varData || []).forEach((v: any) => {
        variantMap[v.sp_no] = v.variant_name + (v.common_name && v.common_name !== 'Unknown' ? ' — ' + v.common_name : '')
      })
    }

    setTrees(rows.map((t: any) => ({
      ...t,
      speciesLabel: (t.variant_sp_no && variantMap[t.variant_sp_no]) || speciesMap[t.sp_no] || '',
    })))

    const { data: careData } = await supabase
      .from('care_schedule')
      .select('*')
      .is('completed_date', null)
      .not('due_date', 'is', null)
    setCareEvents(careData || [])

    try {
      const res = await fetch('/api/reminders?open=1')
      if (res.ok) {
        const rem = await res.json()
        setReminders(Array.isArray(rem) ? rem : [])
      }
    } catch {
      // reminders are optional here; ignore network errors
    }

    setError(null)
    setLoading(false)
  }

  // Called by an overdue row after it saved. null = finished, drop it from the list.
  function handleCareSaved(id: number, patch: Partial<CareEvent> | null) {
    setCareEvents(prev => patch === null
      ? prev.filter(e => e.id !== id)
      : prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  async function completeReminder(id: string) {
    const res = await fetch('/api/reminders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, completed_date: localISO(new Date()) }),
    })
    if (res.ok) setReminders(prev => prev.filter((r: any) => r.id !== id))
    else alert('Could not mark the reminder done.')
  }

  const now = new Date()
  const todayStr = localISO(now)

  function reminderDays(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const [ty, tm, td] = todayStr.split('-').map(Number)
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000)
  }

  const treeByNumber: Record<number, any> = {}
  trees.forEach(t => { if (t.tree_number != null) treeByNumber[t.tree_number] = t })

  const overdueItems: any[] = []
  careEvents.forEach(ev => {
    const t = treeByNumber[ev.tree_number]
    if (!t) return
    if (new Date(ev.due_date) < now) {
      const careLabel = String(ev.event_type || '').replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      overdueItems.push({ tree: t, careLabel, dateStr: ev.due_date, ev })
    }
  })
  overdueItems.sort((a, b) => a.dateStr.localeCompare(b.dateStr))

  const overdueReminders = reminders.filter((r: any) => !r.completed_date && r.due_date && r.due_date < todayStr)
  const total = overdueItems.length + overdueReminders.length

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Overdue</h1>
        <Link href="/" style={{ fontSize: '13px', background: '#f3f4f6', color: '#374151', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
          Dashboard
        </Link>
      </div>
      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
        Tree care tasks and reminders past their due date.
      </p>

      {error && <p style={{ color: '#dc2626', marginBottom: '16px' }}>Error: {error}</p>}
      {loading && <p style={{ color: '#9ca3af' }}>Loading...</p>}

      {!loading && !error && (
        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 4px', color: '#dc2626' }}>
            Overdue &mdash; {total} item{total !== 1 ? 's' : ''}
          </h2>
          {total === 0 && (
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '8px 0' }}>Nothing overdue. Good work.</p>
          )}
          {overdueReminders.map((r: any) => (
            <div
              key={`rem-${r.id}`}
              style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px' }}
            >
              <Link
                href="/reminders"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{r.title}</span>
                  {r.related && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{r.related}</p>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', margin: 0 }}>Reminder</p>
                  <p style={{ fontSize: '11px', color: '#dc2626', margin: '2px 0 0' }}>Due {formatDate(r.due_date)} ({-reminderDays(r.due_date)}d overdue)</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => completeReminder(r.id)}
                style={{ marginTop: '8px', fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #166534', background: '#166534', color: 'white', cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          ))}
          {overdueItems.map(item => (
            <OverdueCareRow
              key={item.ev.id}
              ev={item.ev}
              tree={item.tree}
              careLabel={item.careLabel}
              formatDate={formatDate}
              onSaved={handleCareSaved}
            />
          ))}
        </section>
      )}
    </div>
  )
}
