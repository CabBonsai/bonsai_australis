'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Submission = {
  id: number
  sp_no: number
  submitter_name: string | null
  submitter_email: string | null
  club_name: string | null
  years_growing: string | null
  growing_region: string | null
  general_notes: string
  soil_mix_used: string | null
  feeding_schedule: string | null
  style_achieved: string | null
  specimen_age_years: string | null
  specimen_size: string | null
  back_budding: string | null
  back_budding_detail: string | null
  wire_tolerance: string | null
  wire_tolerance_detail: string | null
  vigor: string | null
  vigor_detail: string | null
  root_tolerance: string | null
  root_tolerance_detail: string | null
  leaf_reduction: string | null
  leaf_reduction_detail: string | null
  nebari_development: string | null
  nebari_development_detail: string | null
  frost_tolerance: string | null
  frost_tolerance_detail: string | null
  deadwood_technique: string | null
  deadwood_technique_detail: string | null
  pest_disease_issues: string | null
  pest_disease_detail: string | null
  would_recommend: string | null
  photo_url: string | null
  photo_consent: boolean
  photo_attribution: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  submitted_at: string
  reviewed_at: string | null
  species?: string
  common_name?: string
}

const TRAIT_ROWS: { key: keyof Submission; detailKey?: keyof Submission; label: string }[] = [
  { key: 'back_budding', detailKey: 'back_budding_detail', label: 'Back budding' },
  { key: 'wire_tolerance', detailKey: 'wire_tolerance_detail', label: 'Wire tolerance' },
  { key: 'vigor', detailKey: 'vigor_detail', label: 'Vigor' },
  { key: 'root_tolerance', detailKey: 'root_tolerance_detail', label: 'Root tolerance' },
  { key: 'leaf_reduction', detailKey: 'leaf_reduction_detail', label: 'Leaf reduction' },
  { key: 'nebari_development', detailKey: 'nebari_development_detail', label: 'Nebari development' },
  { key: 'frost_tolerance', detailKey: 'frost_tolerance_detail', label: 'Frost tolerance' },
  { key: 'deadwood_technique', detailKey: 'deadwood_technique_detail', label: 'Deadwood technique' },
  { key: 'pest_disease_issues', detailKey: 'pest_disease_detail', label: 'Pest/disease issues' },
  { key: 'would_recommend', label: 'Would recommend' },
]

const statusColors: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#fef3c7', color: '#92400e' },
  approved: { bg: '#dcfce7', color: '#166534' },
  rejected: { bg: '#fee2e2', color: '#991b1b' },
}

export default function CommunitySubmissionsAdmin() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [clubFilter, setClubFilter] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [adminNotesDraft, setAdminNotesDraft] = useState<Record<number, string>>({})

  useEffect(() => {
    const timeout = setTimeout(() => fetchSubmissions(), 250)
    return () => clearTimeout(timeout)
  }, [statusFilter, clubFilter])

  async function fetchSubmissions() {
    setLoading(true)

    let query = supabase
      .from('community_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })

    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (clubFilter.trim()) query = query.ilike('club_name', `%${clubFilter.trim()}%`)

    const { data, error: subError } = await query

    if (subError) {
      setError(subError.message)
      setSubmissions([])
      setLoading(false)
      return
    }

    const rows = data || []
    const spNos = [...new Set(rows.map(r => r.sp_no))]
    let speciesMap = new Map<number, { species: string; common_name: string }>()

    if (spNos.length > 0) {
      const { data: speciesRows, error: speciesErr } = await supabase
        .from('species')
        .select('sp_no, species, common_name')
        .in('sp_no', spNos)
      if (speciesErr) {
        setError(speciesErr.message)
      } else {
        speciesMap = new Map((speciesRows || []).map(s => [s.sp_no, s]))
      }
    }

    const merged = rows.map(r => ({ ...r, ...speciesMap.get(r.sp_no) }))
    setSubmissions(merged)
    setError(null)
    setLoading(false)
  }

  async function updateStatus(id: number, status: 'approved' | 'rejected') {
    const { error: updateError } = await supabase
      .from('community_submissions')
      .update({
        status,
        admin_notes: adminNotesDraft[id] ?? undefined,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return
    }
    setSubmissions(prev => prev.filter(s => s.id !== id))
    setExpandedId(null)
  }

  async function deleteSubmission(id: number) {
    if (!confirm('Permanently delete this submission? This cannot be undone.')) return

    const { error: deleteError } = await supabase
      .from('community_submissions')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setSubmissions(prev => prev.filter(s => s.id !== id))
    setExpandedId(null)
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <div>
          <Link href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>&larr; Dashboard</Link>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 0' }}>Community Submissions</h1>
        </div>
      </div>

      <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>Grower-submitted species observations</p>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
          {(['pending', 'approved', 'rejected', 'all'] as const).map((opt, i) => (
            <button
              key={opt}
              onClick={() => setStatusFilter(opt)}
              style={{
                fontSize: '13px',
                fontWeight: 600,
                background: statusFilter === opt ? '#16a34a' : 'white',
                color: statusFilter === opt ? 'white' : '#374151',
                padding: '10px 14px',
                border: 'none',
                borderLeft: i > 0 ? '1px solid #d1d5db' : 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                textTransform: 'capitalize',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Filter by club..."
          value={clubFilter}
          onChange={e => setClubFilter(e.target.value)}
          style={{ flex: 1, minWidth: '160px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: '16px' }}>Error: {error}</p>}
      {loading && <p style={{ color: '#9ca3af' }}>Loading...</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {submissions.map(s => {
          const expanded = expandedId === s.id
          const sc = statusColors[s.status]
          return (
            <li key={s.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>
              <button
                onClick={() => setExpandedId(expanded ? null : s.id)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', background: 'white', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: '#2563eb', margin: 0 }}>
                    {s.species || `sp_no ${s.sp_no}`}
                    {s.common_name && s.common_name !== 'Unknown' ? ` — ${s.common_name}` : ''}
                  </p>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0' }}>
                    {s.submitter_name || 'Anonymous'}{s.club_name ? ` · ${s.club_name}` : ''} · {new Date(s.submitted_at).toLocaleDateString('en-AU')}
                  </p>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: '999px', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                  {s.status}
                </span>
              </button>

              {expanded && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: '#374151', margin: '14px 0' }}>
                    {s.submitter_email && <p style={{ margin: 0 }}><strong>Email:</strong> {s.submitter_email}</p>}
                    {s.years_growing && <p style={{ margin: 0 }}><strong>Years growing:</strong> {s.years_growing}</p>}
                    {s.growing_region && <p style={{ margin: 0 }}><strong>Region:</strong> {s.growing_region}</p>}
                    {s.specimen_age_years && <p style={{ margin: 0 }}><strong>Specimen age:</strong> {s.specimen_age_years}</p>}
                    {s.specimen_size && <p style={{ margin: 0 }}><strong>Specimen size:</strong> {s.specimen_size}</p>}
                    {s.style_achieved && <p style={{ margin: 0 }}><strong>Style:</strong> {s.style_achieved}</p>}
                    {s.soil_mix_used && <p style={{ margin: 0 }}><strong>Soil mix:</strong> {s.soil_mix_used}</p>}
                    {s.feeding_schedule && <p style={{ margin: 0 }}><strong>Feeding:</strong> {s.feeding_schedule}</p>}
                  </div>

                  <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 14px', lineHeight: 1.6 }}>
                    <strong>Notes:</strong> {s.general_notes}
                  </p>

                  <div style={{ marginBottom: '14px' }}>
                    {TRAIT_ROWS.map(t => {
                      const primary = s[t.key] as string | null
                      const detail = t.detailKey ? (s[t.detailKey] as string | null) : null
                      if (!primary) return null
                      return (
                        <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ color: '#6b7280' }}>{t.label}</span>
                          <span style={{ color: '#111827', textAlign: 'right' }}>
                            {primary.replace('_', ' ')}{detail ? ` — ${detail.replace(/_/g, ' ')}` : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {s.photo_url && (
                    <div style={{ marginBottom: '14px' }}>
                      <img src={s.photo_url} alt="" style={{ maxWidth: '240px', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'block' }} />
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                        {s.photo_consent
                          ? `Consented — credit: ${s.photo_attribution || s.submitter_name || 'unattributed'}`
                          : 'No usage consent given'}
                      </p>
                    </div>
                  )}

                  <textarea
                    placeholder="Admin notes (optional, saved on approve/reject)"
                    value={adminNotesDraft[s.id] ?? s.admin_notes ?? ''}
                    onChange={e => setAdminNotesDraft(prev => ({ ...prev, [s.id]: e.target.value }))}
                    style={{ width: '100%', minHeight: '60px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px', boxSizing: 'border-box', marginBottom: '12px', resize: 'vertical' }}
                  />

                  {s.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => updateStatus(s.id, 'approved')}
                        style={{ flex: 1, fontSize: '13px', fontWeight: 600, background: '#16a34a', color: 'white', padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus(s.id, 'rejected')}
                        style={{ flex: 1, fontSize: '13px', fontWeight: 600, background: '#dc2626', color: 'white', padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {s.status === 'rejected' && (
                    <button
                      onClick={() => deleteSubmission(s.id)}
                      style={{ width: '100%', fontSize: '13px', fontWeight: 600, background: '#7f1d1d', color: 'white', padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                    >
                      Delete permanently
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {!loading && submissions.length === 0 && (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>No submissions found.</p>
      )}
    </div>
  )
}
