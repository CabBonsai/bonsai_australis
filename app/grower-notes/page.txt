'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface GrowerNote {
  note_id: string
  topic: string
  category: string
  applies_to: string
  note: string
  data_source: string
  source_name: string
  source_url: string
  source_type: string
  date_logged: string
  needs_verification: boolean
  created_at: string
}

export default function GrowerNotesPage() {
  const [notes, setNotes] = useState<GrowerNote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    topic: '',
    category: '',
    applies_to: '',
    note: '',
    data_source: '',
    source_name: '',
    source_url: '',
    source_type: '',
    date_logged: new Date().toISOString().split('T')[0],
    needs_verification: false,
  })

  useEffect(() => {
    fetchNotes()
  }, [])

  async function fetchNotes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('grower_technique_notes')
      .select('*')
      .order('date_logged', { ascending: false })
    
    if (error) {
      console.error('Error fetching notes:', error)
      setNotes([])
    } else {
      setNotes(data || [])
    }
    setLoading(false)
  }

  const filtered = notes.filter(n =>
    search.trim() === '' ||
    (n.topic || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.applies_to || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.note || '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleSubmit() {
    if (!formData.topic.trim() || !formData.applies_to.trim() || !formData.note.trim()) {
      alert('Topic, applies_to, and note are required')
      return
    }

    if (editing) {
      const { error } = await supabase
        .from('grower_technique_notes')
        .update(formData)
        .eq('note_id', editing)
      
      if (error) {
        alert('Error updating note: ' + error.message)
      } else {
        setEditing(null)
        setFormData({
          topic: '',
          category: '',
          applies_to: '',
          note: '',
          data_source: '',
          source_name: '',
          source_url: '',
          source_type: '',
          date_logged: new Date().toISOString().split('T')[0],
          needs_verification: false,
        })
        setShowForm(false)
        fetchNotes()
      }
    } else {
      const { error } = await supabase
        .from('grower_technique_notes')
        .insert([formData])
      
      if (error) {
        alert('Error adding note: ' + error.message)
      } else {
        setFormData({
          topic: '',
          category: '',
          applies_to: '',
          note: '',
          data_source: '',
          source_name: '',
          source_url: '',
          source_type: '',
          date_logged: new Date().toISOString().split('T')[0],
          needs_verification: false,
        })
        setShowForm(false)
        fetchNotes()
      }
    }
  }

  async function handleDelete(noteId: string) {
    if (!confirm('Delete this note?')) return
    
    const { error } = await supabase
      .from('grower_technique_notes')
      .delete()
      .eq('note_id', noteId)
    
    if (error) {
      alert('Error deleting note: ' + error.message)
    } else {
      fetchNotes()
    }
  }

  function handleEdit(note: GrowerNote) {
    setFormData({
      topic: note.topic,
      category: note.category,
      applies_to: note.applies_to,
      note: note.note,
      data_source: note.data_source,
      source_name: note.source_name,
      source_url: note.source_url,
      source_type: note.source_type,
      date_logged: note.date_logged,
      needs_verification: note.needs_verification,
    })
    setEditing(note.note_id)
    setShowForm(true)
  }

  function resetForm() {
    setFormData({
      topic: '',
      category: '',
      applies_to: '',
      note: '',
      data_source: '',
      source_name: '',
      source_url: '',
      source_type: '',
      date_logged: new Date().toISOString().split('T')[0],
      needs_verification: false,
    })
    setEditing(null)
    setShowForm(false)
  }

  const inputStyle = { width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' as const, marginBottom: '8px' }

  return (
    <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '16px' }}>
      <a href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none', display: 'block', marginBottom: '8px' }}>&larr; Admin Home</a>
      <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 16px' }}>Grower Technique Notes</h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search by topic, category, species, or note text..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', boxSizing: 'border-box' }}
        />
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {showForm ? '✕ Cancel' : '+ Add Note'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f9fafb', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>{editing ? 'Edit Note' : 'New Note'}</h2>
          
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Topic *</label>
          <input type="text" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} style={inputStyle} placeholder="e.g., Wiring protocol, Repotting technique" />

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Category *</label>
          <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={inputStyle} placeholder="e.g., pruning technique, styling philosophy" />

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Applies To (Species) *</label>
          <input type="text" value={formData.applies_to} onChange={e => setFormData({...formData, applies_to: e.target.value})} style={inputStyle} placeholder="e.g., Melaleuca squamea, Banksia serrata" />

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Note *</label>
          <textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} style={{...inputStyle, minHeight: '120px', fontFamily: 'monospace', fontSize: '13px'}} placeholder="Detailed technique, observation, or advice..." />

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Data Source</label>
          <input type="text" value={formData.data_source} onChange={e => setFormData({...formData, data_source: e.target.value})} style={inputStyle} placeholder="e.g., APAB Newsletter No. 1, VNBC June Meeting" />

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Source Name</label>
          <input type="text" value={formData.source_name} onChange={e => setFormData({...formData, source_name: e.target.value})} style={inputStyle} placeholder="e.g., Diana Jones, Lee" />

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Source URL</label>
          <input type="text" value={formData.source_url} onChange={e => setFormData({...formData, source_url: e.target.value})} style={inputStyle} placeholder="https://..." />

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Source Type</label>
          <input type="text" value={formData.source_type} onChange={e => setFormData({...formData, source_type: e.target.value})} style={inputStyle} placeholder="e.g., publication, club newsletter, personal experience" />

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>Date Logged</label>
          <input type="date" value={formData.date_logged} onChange={e => setFormData({...formData, date_logged: e.target.value})} style={inputStyle} />

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
            <input type="checkbox" checked={formData.needs_verification} onChange={e => setFormData({...formData, needs_verification: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            Needs Verification (single source / unconfirmed)
          </label>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSubmit} style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
              {editing ? 'Update Note' : 'Add Note'}
            </button>
            <button onClick={resetForm} style={{ flex: 1, background: 'none', color: '#6b7280', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', fontSize: '14px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>{filtered.length} note{filtered.length !== 1 ? 's' : ''}</p>

      {loading && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>Loading...</p>}

      <div style={{ display: 'grid', gap: '12px' }}>
        {!loading && filtered.map(note => (
          <div key={note.note_id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 2px' }}>{note.topic}</h3>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 4px' }}>
                  <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '2px 6px', borderRadius: '4px', marginRight: '6px' }}>{note.category}</span>
                  <span style={{ fontWeight: '600', color: '#374151' }}>{note.applies_to}</span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => handleEdit(note)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>Edit</button>
                <button onClick={() => handleDelete(note.note_id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>Delete</button>
              </div>
            </div>
            
            <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.6', margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{note.note}</p>
            
            <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span><strong>Source:</strong> {note.source_name || '—'}</span>
              <span><strong>Type:</strong> {note.source_type || '—'}</span>
              <span><strong>Logged:</strong> {note.date_logged || '—'}</span>
              {note.needs_verification && <span style={{ color: '#ea580c', fontWeight: '600' }}>⚠ Unverified</span>}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}