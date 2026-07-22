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
  const [researchTrees, setResearchTrees] = useState<any[]>([])
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

    // Research-pod measurement reminders
    // API route doesn't support a "not null" filter — fetch all rows and filter here.
    const rptRes = await fetch('/api/research-project-trees')
    const allRptRows = rptRes.ok ? await rptRes.json() : []
    const rptData = (allRptRows || []).filter((r: any) => r.next_measurement_date != null)

    if (rptRes.ok && rptData.length > 0) {
      const collectionIds = [...new Set(rptData.map((r: any) => r.collection_id).filter(Boolean))]
      const rptSpNos = [...new Set(rptData.map((r: any) => r.sp_no).filter(Boolean))]
      let collectionMap: Record<string, any> = {}
      let projectMap: Record<number, string> = {}
      let rptSpeciesMap: Record<number, string> = {}

      if (collectionIds.length > 0) {
        const { data: collData } = await supabase
          .from('collection')
          .select('collection_id, display_name, tree_number')
          .in('collection_id', collectionIds)
        ;(collData || []).forEach((c: any) => { collectionMap[c.collection_id] = c })
      }

      const projectIds = [...new Set(rptData.map((r: any) => r.project_id).filter(Boolean))]
      if (projectIds.length > 0) {
        // API route doesn't support .in() with a list of ids — fetch all projects
        // and filter client-side to the ones we actually need.
        const projRes = await fetch('/api/research-projects')
        const allProjects = projRes.ok ? await projRes.json() : []
        const projectIdSet = new Set(projectIds)
        ;(allProjects || [])
          .filter((p: any) => projectIdSet.has(p.id))
          .forEach((p: any) => { projectMap[p.id] = p.title })
      }

      if (rptSpNos.length > 0) {
        const { data: spData } = await supabase
          .from('species')
          .select('sp_no, species, common_name')
          .in('sp_no', rptSpNos)
        ;(spData || []).forEach((s: any) => {
          rptSpeciesMap[s.sp_no] = s.species + (s.common_name && s.common_name !== 'Unknown' ? ' \u2014 ' + s.common_name : '')
        })
      }

      setResearchTrees(rptData.map((r: any) => ({
        ...r,
        treeLabel: collectionMap[r.collection_id]?.display_name || 'Unnamed Tree',
        treeNumber: collectionMap[r.collection_id]?.tree_number || null,
        speciesLabel: rptSpeciesMap[r.sp_no] || '',
        projectTitle: projectMap[r.project_id] || 'Research Project',
      })))
    }

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

  // Research-pod measurement items, same overdue/soon split
  const measurementItems: any[] = []
  researchTrees.forEach(rt => {
    const val = rt.next_measurement_date
    if (!val) return
    const d = new Date(val)
    if (d < now) {
      measurementItems.push({ tree: rt, dateStr: val, status: 'overdue' })
    } else if (d <= soonCutoff) {
      measurementItems.push({ tree: rt, dateStr: val, status: 'soon' })
    }
  })
  const overdueMeasurements = measurementItems.filter(i => i.status === 'overdue').sort((a, b) => a.dateStr.localeCompare(b.dateStr))
  const soonMeasurements = measurementItems.filter(i => i.status === 'soon').sort((a, b) => a.dateStr.localeCompare(b.dateStr))

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
          <Link href="/review" style={{ fontSize: '13px', background: '#f3f4f6', color: '#374151', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            Review Queue
          </Link>
          <Link href="/species/new" style={{ fontSize: '13px', background: '#16a34a', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            + New Species
          </Link>
          <Link href="/collection" style={{ fontSize: '13px', background: '#2563eb', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            My Collection
          </Link>
          <Link href="/bulk-edit" style={{ fontSize: '13px', background: '#7c3aed', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            Bulk Edit
          </Link>
          <Link href="/grower-notes" style={{ fontSize: '13px', background: '#ea580c', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            Grower Notes
          </Link>
          <Link href="/gallery-admin" style={{ fontSize: '13px', background: '#0d9488', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            Gallery Admin
          </Link>
          <Link href="/blog-admin" style={{ fontSize: '13px', background: '#c026d3', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            Blog Admin
          </Link>
	  <Link href="/research-projects" style={{ fontSize: '13px', background: '#059669', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            Research Projects
          </Link>
          <Link href="/community-submissions" style={{ fontSize: '13px', background: '#b91c1c', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            Community Submissions
          </Link>
          <Link href="/tubestock-admin" style={{ fontSize: '13px', background: '#84670d', color: 'white', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none' }}>
            Tubestock
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

          <section style={{ marginBottom: '28px' }}>
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

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 4px', color: '#059669' }}>
              Research Pod Measurements Due &mdash; {overdueMeasurements.length + soonMeasurements.length} item{(overdueMeasurements.length + soonMeasurements.length) !== 1 ? 's' : ''}
            </h2>
            {overdueMeasurements.length === 0 && soonMeasurements.length === 0 && (
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: '8px 0' }}>No measurements due in the next 14 days.</p>
            )}
            {overdueMeasurements.map((item, i) => (
              <Link
                key={`overdue-${i}`}
                href={`/research-projects/${item.tree.project_id}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px' }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.tree.treeLabel}</span>
                  {item.tree.treeNumber && <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>#{item.tree.treeNumber}</span>}
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{item.tree.projectTitle}{item.tree.speciesLabel ? ` \u00b7 ${item.tree.speciesLabel}` : ''}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', margin: 0 }}>Measurement</p>
                  <p style={{ fontSize: '11px', color: '#dc2626', margin: '2px 0 0' }}>Due {formatDate(item.dateStr)}</p>
                </div>
              </Link>
            ))}
            {soonMeasurements.map((item, i) => (
              <Link
                key={`soon-${i}`}
                href={`/research-projects/${item.tree.project_id}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px' }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.tree.treeLabel}</span>
                  {item.tree.treeNumber && <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>#{item.tree.treeNumber}</span>}
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>{item.tree.projectTitle}{item.tree.speciesLabel ? ` \u00b7 ${item.tree.speciesLabel}` : ''}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#b45309', margin: 0 }}>Measurement</p>
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