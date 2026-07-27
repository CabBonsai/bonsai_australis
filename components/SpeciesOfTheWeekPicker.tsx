'use client'

import { useState } from 'react'

// Admin-side picker for Species of the Week. Calls the service-role API route
// (/api/species-of-the-week) rather than writing directly via the anon
// Supabase client, since species_of_the_week has SELECT-only RLS.
//
// Workflow: paste sp_no, a short spiel, the photo URL (reuse
// species.reference_photo or upload separately), and the Spotlight PDF's
// storage URL (generated from the species page, copied to clipboard already).
// Submitting deactivates whatever was previously active and activates this one.

export default function SpeciesOfTheWeekPicker() {
  const [spNo, setSpNo] = useState('')
  const [spiel, setSpiel] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit() {
    if (!spNo) { setMessage('sp_no is required'); return }
    setSaving(true)
    setMessage(null)
    try {
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
      if (!res.ok) {
        setMessage('Error: ' + json.error)
      } else {
        setMessage(`Species of the Week set to sp_no ${spNo}.`)
        setSpNo(''); setSpiel(''); setPhotoUrl(''); setPdfUrl('')
      }
    } catch (e: any) {
      setMessage('Error: ' + e.message)
    } finally {
      setSaving(false)
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
    <div style={{
      border: '1px solid #ded4bd',
      borderRadius: '14px',
      background: '#fffdf9',
      padding: '22px',
      maxWidth: '600px',
    }}>
      <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#3f5228', marginBottom: '18px' }}>
        Set Species of the Week
      </h3>

      <label style={labelStyle}>sp_no</label>
      <input style={fieldStyle} value={spNo} onChange={e => setSpNo(e.target.value)} placeholder="e.g. 298" />

      <label style={labelStyle}>Spiel (front-page blurb)</label>
      <textarea style={{ ...fieldStyle, minHeight: '100px', resize: 'vertical' }} value={spiel} onChange={e => setSpiel(e.target.value)} />

      <label style={labelStyle}>Photo URL</label>
      <input style={fieldStyle} value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="Reuse species.reference_photo, or paste a new one" />

      <label style={labelStyle}>Spotlight PDF URL</label>
      <input style={fieldStyle} value={pdfUrl} onChange={e => setPdfUrl(e.target.value)} placeholder="Copied to clipboard when you generate the Spotlight PDF" />

      {message && (
        <p style={{ fontSize: '14px', color: message.startsWith('Error') ? '#c04545' : '#5c7a2a', fontWeight: 600, marginBottom: '14px' }}>
          {message}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={saving}
        style={{
          background: '#3f5228', color: '#fdfaf3', padding: '12px 22px',
          borderRadius: '10px', fontWeight: 700, border: 'none',
          cursor: 'pointer', opacity: saving ? 0.5 : 1,
        }}
      >
        {saving ? 'Saving...' : 'Set as Active'}
      </button>
    </div>
  )
}
