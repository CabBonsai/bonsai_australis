'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function JournalPhotoField({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('tree-photos').upload(path, file)
      if (error) { alert('Upload failed: ' + error.message); return }
      const { data } = supabase.storage.from('tree-photos').getPublicUrl(path)
      onChange(data.publicUrl)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      {value && (
        <img src={value} alt="Journal photo" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px', border: '1px solid #e2e8f0' }} />
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <label htmlFor="journal-photo-upload" style={{ flex: 1, textAlign: 'center', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', fontSize: '13px', cursor: 'pointer' }}>
          {uploading ? 'Uploading...' : value ? '📷 Replace Photo' : '📷 Add Photo'}
        </label>
        <input id="journal-photo-upload" type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
        {value && <button type="button" onClick={() => onChange('')} style={{ color: '#dc2626', fontSize: '13px', padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>}
      </div>
    </div>
  )
}

function JournalEntryCard({ entry, onSaved, onDelete }: { entry: any, onSaved: () => void, onDelete: (id: string) => void }) {
  const [local, setLocal] = useState(entry)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  function update(field: string, value: any) {
    setLocal((prev: any) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('journal_entries')
      .update({
        entry_date: local.entry_date,
        title: local.title,
        body_text: local.body_text,
        photos: local.photo_url ? [local.photo_url] : [],
        publish_status: local.publish_status,
        target_publish_date: local.target_publish_date || null,
        tags: local.tags,
      })
      .eq('entry_id', local.entry_id)
    setSaving(false)
    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('Saved')
      onSaved()
      setTimeout(() => setMessage(null), 2000)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this journal entry permanently?')) return
    const { error } = await supabase.from('journal_entries').delete().eq('entry_id', local.entry_id)
    if (!error) onDelete(local.entry_id)
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '10px', background: '#fafaf7' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <input
          type="date"
          value={local.entry_date || ''}
          onChange={e => update('entry_date', e.target.value)}
          style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px', fontSize: '13px' }}
        />
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '20px',
          background: local.publish_status === 'private' ? '#f1f5f9' : '#dcfce7',
          color: local.publish_status === 'private' ? '#6b7280' : '#16a34a',
        }}>
          {local.publish_status === 'private' ? 'Private' : 'Ready to publish'}
        </span>
      </div>
      <input
        type="text"
        value={local.title || ''}
        onChange={e => update('title', e.target.value)}
        placeholder="Entry title..."
        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}
      />
      <textarea
        value={local.body_text || ''}
        onChange={e => update('body_text', e.target.value)}
        placeholder="What happened today? Voice-to-text friendly..."
        rows={4}
        style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', lineHeight: 1.5, resize: 'vertical', marginBottom: '8px' }}
      />

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{ color: '#2563eb', fontSize: '13px', background: 'none', border: 'none', padding: 0, marginBottom: '8px', cursor: 'pointer' }}
      >
        {expanded ? 'Hide details ▲' : 'Photo, tags & publish settings ▼'}
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
          <JournalPhotoField value={local.photo_url || ''} onChange={v => update('photo_url', v)} />
          <input
            type="text"
            value={local.tags || ''}
            onChange={e => update('tags', e.target.value)}
            placeholder="Tags (e.g. styling, repotting, wiring)"
            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px' }}
          />
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Publish status</label>
            <select
              value={local.publish_status || 'private'}
              onChange={e => update('publish_status', e.target.value)}
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px' }}
            >
              <option value="private">Private</option>
              <option value="ready_to_publish">Ready to publish</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Target publish date</label>
            <input
              type="date"
              value={local.target_publish_date || ''}
              onChange={e => update('target_publish_date', e.target.value)}
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px' }}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" onClick={handleDelete} style={{ color: '#dc2626', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>
          Delete entry
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {message && <span style={{ fontSize: '12px', color: '#16a34a' }}>{message}</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ background: '#3f5228', color: '#fdfaf3', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function JournalSection({ collectionId, spNo }: { collectionId: string, spNo: number | null }) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('collection_id', collectionId)
      .order('entry_date', { ascending: false })

    setEntries((data || []).map((e: any) => ({ ...e, photo_url: e.photos?.[0] || '' })))
    setLoading(false)
  }

  useEffect(() => {
    fetchEntries()
  }, [collectionId])

  async function handleAddEntry() {
    setAdding(true)
    const { error } = await supabase.from('journal_entries').insert({
      collection_id: collectionId,
      sp_no: spNo,
      entry_date: new Date().toISOString().split('T')[0],
      title: 'New entry',
      publish_status: 'private',
    })
    setAdding(false)
    if (error) {
      alert('Error adding entry: ' + error.message)
    } else {
      fetchEntries()
    }
  }

  function handleDelete(entryId: string) {
    setEntries(entries.filter(e => e.entry_id !== entryId))
  }

  return (
    <div>
      {loading && <p style={{ fontSize: '13px', color: '#9ca3af' }}>Loading journal...</p>}
      {!loading && entries.length === 0 && <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '10px' }}>No journal entries yet.</p>}
      {!loading && entries.map(entry => (
        <JournalEntryCard key={entry.entry_id} entry={entry} onSaved={fetchEntries} onDelete={handleDelete} />
      ))}
      <button
        type="button"
        onClick={handleAddEntry}
        disabled={adding}
        style={{
          width: '100%', border: '2px dashed #d1d5db', borderRadius: '10px', padding: '12px',
          fontSize: '14px', color: '#6b7280', background: 'none', cursor: 'pointer', marginTop: '4px',
        }}
      >
        {adding ? 'Adding...' : '+ Add Journal Entry'}
      </button>
    </div>
  )
}
