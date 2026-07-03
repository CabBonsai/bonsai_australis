'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const CARE_TYPES = [
  { key: 'next_repot_due', label: 'Repotting' },
  { key: 'next_fertilise_due', label: 'Fertilising' },
  { key: 'due_prune_date', label: 'Pruning' },
  { key: 'date_check_wire', label: 'Wire check' },
]

export default function Home() {
  const [trees, setTrees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchDashboard() }, [])

  async function fetchDashboard() {
    setLoading(true)
    const { data, error } = await supabase
      .from('collection')
      .select('*')
      .eq('in_collection', true)
      .order('tree_number', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const rows = data || []
    const spNos = [...new Set(rows.map((t: any) => t.sp_no).filter(Boolean))]
    const variantSpNos = [...new Set(rows.map((t: any) => t.variant_sp_no).filter(Boolean))]
    let speciesMap: Record<number, string> = {}
    let variantMap: Record<number, string> = {}

    if (spNos.length > 0) {
      const { data: spData } = await supabase
        .from('species')
        .select('sp_no, species, common_name')
        .in('sp_no', spNos)
      ;(spData || []).forEach((s: any) => {
        speciesMap[s.sp_no] = s.species + (s.common_name && s.common_name !== 'Unknown' ? ' \u2014 ' + s.common_name : '')
      })
    }

    if (variantSpNos.length > 0) {
      const { data: varData } = await supabase
        .from('variants')
        .select('sp_no, variant_name, common_name')
        .in('sp_no', variantSpNos)
      ;(varData || []).forEach((v: any) => {
        variantMap[v.sp_no] = v.variant_name + (v.common_name && v.common_name !== 'Unknown' ? ' \u2014 ' + v.common_name : '')
      })
    }

    setTrees(rows.map((t: any) => ({
      ...t,
      speciesLabel: (t.variant_sp_no && variantMap[t.variant_sp_no]) || speciesMap[t.sp_no] || ''
    })))
    setError(null)
    setLoading(false)
  }

  const now = new Date()
  const soonCutoff = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  function daysUntil(dateStr: string) {
    const d = new Date(dateStr)
    return Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  }

  // Build a flat list of { tree, careLabel, dateStr, status: 'overdue' | 'soon' }
  const careItems: any[] = []
  trees.forEach(t => {
    CARE_TYPES.forEach(ct => {
      const val = t[ct.key]
      if (!val) return
      const d = new Date(val)
      if (d < now) {
        careItems.push({ tree: t, careLabel: ct.label, dateStr: val, status: 'overdue' })
      } else if (d <= soonCutoff) {
        careItems.push({ tree: t, careLabel: ct.label, dateStr: val, status: 'soon' })
      }
    })
  })

  const overdueItems = careItems.filter(i => i.status === 'overdue').sort((a, b) => a.dateStr.localeCompare(b.dateStr))
  const soonItems = careItems.filter(i => i.status === 'soon').sort((a, b) => a.dateStr.localeCompare(b.dateStr))

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Bonsai Australis</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/species" style={{ fontSize: '13px', background: '#f3f4f6', color: '#374151', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            Species Database
          </Link>
          <Link href="/species/new" style={{ fontSize: '13px', background: '#16a34a', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            + New Species
          </Link>
          <Link href="/collection" style={{ fontSize: '13px', background: '#2563eb', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            My Collection
          </Link>
          <button
            onClick={async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = '/login' }}
            style={{ fontSize: '13px', background: '#e5e7eb', color: '#374151', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
          >
            Log Out
          </button>
        </div>
      </div>

      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>Care Dashboard</p>

      {error && <p style={{ color: '#dc2626', marginBottom: '16px' }}>Error: {error}</p>}
      {loading && <p style={{ color: '#9ca3af' }}>Loading...</p>}

      {!loading && !error && (
        <>
          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 4px', color: '#dc2626' }}>
              Overdue &mdash; {overdueItems.length} item{overdueItems.length !== 1 ? 's' : ''}
            </h2>
            {overdueItems.length === 0 && (
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: '8px 0' }}>Nothing overdue. Good work.</p>
            )}
            {overdueItems.map((item, i) => (
              <Link
                key={i}
                href={`/collection/${item.tree.collection_id}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px' }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.tree.display_name || 'Unnamed Tree'}</span>
                  {item.tree.tree_number && <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>#{item.tree.tree_number}</span>}
                  {item.tree.speciesLabel && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{item.tree.speciesLabel}</p>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', margin: 0 }}>{item.careLabel}</p>
                  <p style={{ fontSize: '11px', color: '#dc2626', margin: '2px 0 0' }}>Due {formatDate(item.dateStr)}</p>
                </div>
              </Link>
            ))}
          </section>

          <section>
            <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 4px', color: '#b45309' }}>
              Due Soon (next 14 days) &mdash; {soonItems.length} item{soonItems.length !== 1 ? 's' : ''}
            </h2>
            {soonItems.length === 0 && (
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: '8px 0' }}>Nothing coming up in the next 14 days.</p>
            )}
            {soonItems.map((item, i) => (
              <Link
                key={i}
                href={`/collection/${item.tree.collection_id}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px' }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.tree.display_name || 'Unnamed Tree'}</span>
                  {item.tree.tree_number && <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>#{item.tree.tree_number}</span>}
                  {item.tree.speciesLabel && <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{item.tree.speciesLabel}</p>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#b45309', margin: 0 }}>{item.careLabel}</p>
                  <p style={{ fontSize: '11px', color: '#b45309', margin: '2px 0 0' }}>Due {formatDate(item.dateStr)} ({daysUntil(item.dateStr)}d)</p>
                </div>
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
