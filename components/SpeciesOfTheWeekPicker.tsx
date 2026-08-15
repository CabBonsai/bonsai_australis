'use client'

import { useEffect, useState, useCallback } from 'react'

// Admin-side picker for Species of the Week. Calls the service-role API route
// (/api/species-of-the-week) rather than writing directly via the anon
// Supabase client, since species_of_the_week has SELECT-only RLS.
//
// Two modes:
// - New entry: pick a sp_no, write a spiel, set it active. Same as before.
// - Edit existing: click Edit on a history row — loads that row's spiel/photo
//   into the form, submit button becomes "Save Changes" (PATCH), with an
//   optional "make this active again" checkbox rather than always reactivating.
// History list also has a per-row Hide/Show toggle (visible column) so an
// outdated or no-longer-suitable past pick can be pulled from the public
// archive without deleting the row — full history stays intact either way.

type Entry = {
  id: string
  sp_no: number
  spiel: string | null
  photo_url: string | null
  pdf_url: string | null
  active: boolean
  visible: boolean
  created_at: string
  species: { species: string; common_name: string | null } | null
}

export default function SpeciesOfTheWeekPicker() {
  const [spNo, setSpNo] = useState('')
  const [spiel, setSpiel] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [makeActive, setMakeActive] = useState(false)

  const [history, setHistory] = useState<Entry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/species-of-the-week')
      const json = await res.json()
      if (Array.isArray(json)) setHistory(json)
    } catch {
      // history is a convenience list, not critical — fail silently
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  function resetForm() {
    setSpNo(''); setSpiel(''); setPhotoUrl(''); setPdfUrl('')
    setEditingId(null); setMakeActive(false)
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id)
    setSpNo(String(entry.sp_no))
    setSpiel(entry.spiel || '')
    setPhotoUrl(entry.photo_url || '')
    setPdfUrl(entry.pdf_url || '')
    setMakeActive(entry.active)
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    if (!editingId && !spNo) { setMessage('sp_no is required'); return }
    setSaving(true)
    setMessage(null)
    try {
      if (editingId) {
        const res = await fetch('/api/species-of-the-week', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            spiel: spiel || null,
            photo_url: photoUrl || null,
            make_active: makeActive,
          }),
        })
        const json = await res.json()
        if (!res.ok) { setMessage('Error: ' + json.error) }
        else {
          setMessage('Changes saved.')
          resetForm()
          loadHistory()
        }
      } else {
        const res = await fetch('/api/species-of-the-week', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sp_no: parseInt(spNo, 10),
            spiel: spiel || null,
            photo_url: photoUrl || null,
            pdf_url: pdfUrl || null,
          }),
        })
        const json = await res.json()
        if (!res.ok) { setMessage('Error: ' + json.error) }
        else {
          setMessage(`Species of the Week set to sp_no ${spNo}.`)
          resetForm()
          loadHistory()
        }
      }
    } catch (e: any) {
      setMessage('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleVisible(entry: Entry) {
    try {
      const res = await fetch('/api/species-of-the-week', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, visible: !entry.visible }),
      })
      if (res.ok) loadHistory()
    } catch {
      // no-op — the row just won't visually update, user can retry
    }
  }

  const fieldStyle = {
    width: '100%',
    boxSizing: 'border-box' as const,
    border: '1.5px solid #e2dac2',
    borderRadius: '10px',
    padding: '12px 16px',
    fontSize: '15px',
    color: '#2b2620',
    background: '#fffefb',
    outline: 'none',
    marginBottom: '14px',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: '#8a7f5f',
    marginBottom: '6px',
  }

  return (
    <div>
      <div style={{
        border: '1px solid #ded4bd',
        borderRadius: '14px',
        background: '#fffdf9',
        padding: '22px',
        maxWidth: '600px',
        marginBottom: '32px',
      }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#3f5228', marginBottom: '18px' }}>
          {editingId ? 'Edit Spotlight Entry' : 'Set Species of the Week'}
        </h3>

        <label style={labelStyle}>sp_no</label>
        <input
          style={{ ...fieldStyle, background: editingId ? '#f0ece0' : fieldStyle.background }}
          value={spNo}
          onChange={e => setSpNo(e.target.value)}
          placeholder="e.g. 298"
          disabled={!!editingId}
        />

        <label style={labelStyle}>Spiel / Spotlight write-up</label>
        <textarea
          style={{ ...fieldStyle, minHeight: '140px', resize: 'vertical' }}
          value={spiel}
          onChange={e => setSpiel(e.target.value)}
          placeholder="Write the public-facing story for this pick — background, why it's a good bonsai candidate, anything you don't mind giving away for free. This is what shows on the Spotlight page, separate from the master species_notes record."
        />

        <label style={labelStyle}>Photo URL</label>
        <input style={fieldStyle} value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="Reuse species.reference_photo, or paste a new one" />

        {!editingId && (
          <>
            <label style={labelStyle}>Spotlight PDF URL (legacy, optional)</label>
            <input style={fieldStyle} value={pdfUrl} onChange={e => setPdfUrl(e.target.value)} placeholder="No longer used by the public page — safe to leave blank" />
          </>
        )}

        {editingId && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#3f5228', marginBottom: '14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={makeActive} onChange={e => setMakeActive(e.target.checked)} />
            Make this the active Species of the Week again
          </label>
        )}

        {message && (
          <p style={{ fontSize: '14px', color: message.startsWith('Error') ? '#c04545' : '#5c7a2a', fontWeight: 600, marginBottom: '14px' }}>
            {message}
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              background: '#3f5228', color: '#fdfaf3', padding: '12px 22px',
              borderRadius: '10px', fontWeight: 700, border: 'none',
              cursor: 'pointer', opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Set as Active'}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              style={{
                background: 'transparent', color: '#8a7f5f', padding: '12px 22px',
                borderRadius: '10px', fontWeight: 600, border: '1.5px solid #e2dac2',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#3f5228', marginBottom: '14px' }}>
        History (last 20)
      </h3>

      {loadingHistory && <p style={{ color: '#8a7f5f', fontSize: '14px' }}>Loading…</p>}

      {!loadingHistory && history.length === 0 && (
        <p style={{ color: '#8a7f5f', fontSize: '14px' }}>No entries yet.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '760px' }}>
        {history.map(entry => (
          <div
            key={entry.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              border: '1px solid #ded4bd',
              borderRadius: '10px',
              padding: '12px 16px',
              background: entry.active ? '#f4f9e8' : '#fffdf9',
              opacity: entry.visible ? 1 : 0.55,
            }}
          >
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#2b2620', margin: 0 }}>
                {entry.species?.common_name || entry.species?.species || `sp_no ${entry.sp_no}`}
                {entry.active && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 700, color: '#5c7a2a', textTransform: 'uppercase' }}>
                    ● Active
                  </span>
                )}
                {!entry.visible && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 700, color: '#a04545', textTransform: 'uppercase' }}>
                    Hidden
                  </span>
                )}
              </p>
              <p style={{ fontSize: '12px', color: '#8a7f5f', margin: '2px 0 0' }}>
                {new Date(entry.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => startEdit(entry)}
              style={{
                background: 'transparent', border: '1.5px solid #3f5228', color: '#3f5228',
                borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Edit
            </button>
            <button
              onClick={() => toggleVisible(entry)}
              style={{
                background: 'transparent', border: '1.5px solid #8a7f5f', color: '#8a7f5f',
                borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {entry.visible ? 'Hide from archive' : 'Unhide'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
