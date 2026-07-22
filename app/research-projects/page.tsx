'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const statusColor: Record<string, string> = {
  active: '#16a34a',
  completed: '#2563eb',
  abandoned: '#6b7280',
}

export default function ResearchProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const [title, setTitle] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [methodology, setMethodology] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [creating, setCreating] = useState(false)

  useEffect(() => { fetchProjects() }, [])

  async function fetchProjects() {
    setLoading(true)

    const projectsRes = await fetch('/api/research-projects')
    const projectsData = await projectsRes.json()

    if (!projectsRes.ok) {
      setError(projectsData.error || 'Failed to load research projects')
      setLoading(false)
      return
    }

    const rows = projectsData || []

    // Fetch all research_project_trees rows and count them per project client-side.
    // (The original query used .in('project_id', projectIds) — the API route only
    // filters by a single project_id, so we fetch all trees and tally here instead.)
    const treesRes = await fetch('/api/research-project-trees')
    const treeRows = treesRes.ok ? await treesRes.json() : []

    let countMap: Record<number, number> = {}
    ;(treeRows || []).forEach((t: any) => {
      countMap[t.project_id] = (countMap[t.project_id] || 0) + 1
    })

    setProjects(rows.map((p: any) => ({ ...p, treeCount: countMap[p.id] || 0 })))
    setError(null)
    setLoading(false)
  }

  async function handleCreate() {
    if (!title.trim()) { alert('Title is required.'); return }
    setCreating(true)

    const res = await fetch('/api/research-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        hypothesis: hypothesis.trim() || null,
        methodology: methodology.trim() || null,
        start_date: startDate || null,
        status: 'active',
      }),
    })
    const data = await res.json()

    setCreating(false)
    if (!res.ok) { alert('Error: ' + data.error); return }

    // POST returns an array (insert().select()), so grab the first row.
    const created = Array.isArray(data) ? data[0] : data
    window.location.href = `/research-projects/${created.id}`
  }

  return (
    <main style={{ maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>

      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '24px',
            width: '100%', maxWidth: '480px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>New Research Project</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6b7280' }}>&#x2715;</button>
            </div>

            <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Research Pod 1"
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px' }}
            />

            <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Hypothesis</label>
            <textarea
              value={hypothesis}
              onChange={e => setHypothesis(e.target.value)}
              rows={2}
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px' }}
            />

            <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Methodology</label>
            <textarea
              value={methodology}
              onChange={e => setMethodology(e.target.value)}
              rows={2}
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px' }}
            />

            <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '16px' }}
            />

            <button
              onClick={handleCreate}
              disabled={creating}
              style={{ width: '100%', padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <a href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>&larr; Admin Home</a>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '4px 0 0' }}>Research Projects</h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
        >
          + New Project
        </button>
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: '16px' }}>Error: {error}</p>}
      {loading && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>Loading...</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
        {!loading && projects.map(p => (
          <Link
            key={p.id}
            href={`/research-projects/${p.id}`}
            style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: '700', fontSize: '16px' }}>{p.title}</span>
              <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: (statusColor[p.status] || '#6b7280') + '22', color: statusColor[p.status] || '#6b7280', textTransform: 'capitalize' }}>
                {p.status}
              </span>
            </div>
            {p.hypothesis && <p style={{ fontSize: '13px', color: '#6b7280', margin: '6px 0 0' }}>{p.hypothesis}</p>}
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '8px 0 0' }}>
              {p.treeCount} tree{p.treeCount !== 1 ? 's' : ''}{p.start_date ? ` \u00b7 started ${p.start_date}` : ''}
            </p>
          </Link>
        ))}
        {!loading && projects.length === 0 && <p style={{ color: '#9ca3af' }}>No research projects yet.</p>}
      </div>
    </main>
  )
}