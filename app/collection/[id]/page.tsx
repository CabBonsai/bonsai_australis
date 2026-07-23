'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import JournalSection from '@/components/JournalSection'

function Section({ title, defaultOpen, children }: { title: string, defaultOpen?: boolean, children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div style={{ border: '1px solid #e2dac2', borderRadius: '10px', marginBottom: '14px', overflow: 'hidden', background: '#fffefb' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 22px',
          fontWeight: 600,
          fontSize: '17px',
          textAlign: 'left',
          background: open ? '#f3efe2' : 'transparent',
          color: '#3f5228',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {title}
        <span style={{ color: '#8a9a6d', fontSize: '15px' }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </button>
      {open && (
        <div style={{ padding: '22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: '15px' }}>
      <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a7f5f', marginBottom: '6px' }}>{label}</span>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #e2dac2',
  borderRadius: '10px',
  padding: '12px 16px',
  fontSize: '17px',
  minHeight: '48px',
  fontFamily: 'inherit',
  color: '#2b2620',
  background: '#fffefb',
  outline: 'none',
  boxSizing: 'border-box',
}

const overdueInputStyle: React.CSSProperties = {
  ...inputStyle,
  border: '1.5px solid #dc2626',
  background: '#fef2f2',
}

const STYLE_OPTIONS = ['Formal Upright', 'Informal Upright', 'Slanting', 'Cascade', 'Semi-Cascade', 'Windswept', 'Literati', 'Group/Forest', 'Raft', 'Root-over-rock', 'Multi-trunk', 'Broom', 'Driftwood']
const SOURCE_OPTIONS = ['Nursery', 'Grown from Seed', 'Grown from Cutting', 'Air Layer', 'Collected (Yamadori)', 'Club Auction', 'Online Purchase', 'Private Sale', 'Gift', 'Other']
const DEV_STAGE_OPTIONS = ['Raw Material', 'Initial Styling', 'Developing', 'Refining', 'Mature / Show Ready', 'Maintenance']
const TRAINING_STAGE_OPTIONS = ['Untrained', 'Primary Wiring', 'Branch Development', 'Ramification', 'Refinement', 'Maintenance Only']
const ORIGIN_MATERIAL_OPTIONS = ['Nursery Stock', 'Yamadori (Collected)', 'Cutting', 'Seedling', 'Air Layer', 'Pre-Bonsai', 'Field Grown', 'Tubestock']

function Dropdown({ value, onChange, options, category }: { value: string, onChange: (v: string) => void, options: string[], category: string }) {
  const [customOptions, setCustomOptions] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [newValue, setNewValue] = useState('')

  useEffect(() => {
    supabase.from('dropdown_options').select('value').eq('category', category)
      .then(({ data }) => setCustomOptions((data || []).map((d: any) => d.value)))
  }, [category])

  const allOptions = [...options, ...customOptions.filter(c => !options.includes(c))].sort()

  async function handleAdd() {
    const trimmed = newValue.trim()
    if (!trimmed) return
    await supabase.from('dropdown_options').upsert({ category, value: trimmed }, { onConflict: 'category,value' })
    setCustomOptions(prev => [...prev, trimmed])
    onChange(trimmed)
    setNewValue('')
    setAdding(false)
  }

  if (adding) {
    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder="New option..."
          style={inputStyle}
          autoFocus
        />
        <button type="button" onClick={handleAdd} style={{ background: '#3f5228', color: '#fdfaf3', padding: '0 16px', borderRadius: '8px', border: 'none', fontSize: '15px', cursor: 'pointer' }}>Add</button>
        <button type="button" onClick={() => setAdding(false)} style={{ color: '#8a7f5f', padding: '0 10px', fontSize: '15px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
      </div>
    )
  }

  return (
    <select
      value={value || ''}
      onChange={e => {
        if (e.target.value === '__add_new__') {
          setAdding(true)
        } else {
          onChange(e.target.value)
        }
      }}
      style={inputStyle}
    >
      <option value="">Select...</option>
      {allOptions.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__add_new__">+ Add new option...</option>
    </select>
  )
}

function PhotoField({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const inputId = `photo-${label.replace(/\s+/g, '-')}`

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('tree-photos').upload(path, file)
      if (error) {
        alert('Upload failed: ' + error.message)
        return
      }
      const { data } = supabase.storage.from('tree-photos').getPublicUrl(path)
      onChange(data.publicUrl)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a7f5f', marginBottom: '6px' }}>{label}</span>
      {value && (
        <img
          src={value}
          alt={label}
          onClick={() => setLightboxOpen(true)}
          style={{ width: '128px', height: '128px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px', border: '1px solid #e2dac2', cursor: 'pointer' }}
        />
      )}
      {lightboxOpen && value && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', cursor: 'zoom-out' }}
        >
          <img
            src={value}
            alt={label}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
          />
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <label htmlFor={inputId} style={{ flex: 1, textAlign: 'center', background: '#f3efe2', border: '1.5px solid #e2dac2', borderRadius: '10px', padding: '11px 14px', fontSize: '15px', cursor: 'pointer', color: '#2b2620' }}>
          {uploading ? 'Uploading...' : value ? '📷 Replace Photo' : '📷 Add Photo'}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: 'none' }}
          disabled={uploading}
        />
        {value && (
          <button type="button" onClick={() => onChange('')} style={{ color: '#c04545', fontSize: '15px', padding: '0 10px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
      </div>
    </div>
  )
}

function HeroPhotoField({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('tree-photos').upload(path, file)
      if (error) {
        alert('Upload failed: ' + error.message)
        return
      }
      const { data } = supabase.storage.from('tree-photos').getPublicUrl(path)
      onChange(data.publicUrl)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      {value ? (
        <img
          src={value}
          alt="Primary photo"
          onClick={() => setLightboxOpen(true)}
          style={{
            width: '100%',
            maxHeight: '360px',
            objectFit: 'cover',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
            display: 'block',
          }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '220px',
          background: '#f1f5f9',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          color: '#9ca3af',
        }}>
          No primary photo yet
        </div>
      )}

      {lightboxOpen && value && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', cursor: 'zoom-out' }}
        >
          <img
            src={value}
            alt="Primary photo"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <label htmlFor="hero-primary-photo" style={{ flex: 1, textAlign: 'center', background: '#f3efe2', border: '1.5px solid #e2dac2', borderRadius: '10px', padding: '11px 14px', fontSize: '15px', cursor: 'pointer', color: '#2b2620' }}>
          {uploading ? 'Uploading...' : value ? '📷 Replace Primary Photo' : '📷 Add Primary Photo'}
        </label>
        <input
          id="hero-primary-photo"
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: 'none' }}
          disabled={uploading}
        />
        {value && (
          <button type="button" onClick={() => onChange('')} style={{ color: '#c04545', fontSize: '15px', padding: '0 10px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
      </div>
    </div>
  )
}

function SpeciesAutocomplete({ value, onChange }: { value: number | null, onChange: (spNo: number | null, name: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loadedName, setLoadedName] = useState('')
useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      setOpen(false)
    }
    if (open) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [open])
  useEffect(() => {
    if (value && !loadedName) {
      supabase.from('species').select('sp_no, species, common_name')
        .eq('sp_no', value).single()
        .then(({ data }) => {
          if (data) {
            setLoadedName(data.species)
            setQuery(data.species)
          }
        })
    }
  }, [value])

  useEffect(() => {
    if (!query.trim() || query === loadedName) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('species')
        .select('sp_no, species, common_name')
        .or(`species.ilike.%${query}%,common_name.ilike.%${query}%,sp_no.eq.${parseInt(query) || 0}`)
        .order('species', { ascending: true })
        .limit(50)
      setResults(data || [])
    }, 250)
    return () => clearTimeout(timeout)
  }, [query])

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(null, '') }}
        onFocus={() => setOpen(true)}
        placeholder="Search species name..."
        style={inputStyle}
      />
      {open && results.length > 0 && (
        <ul style={{position:'absolute',zIndex:999,background:'#fffefb',border:'1px solid #e2dac2',borderRadius:'12px',marginTop:'4px',width:'100%',maxHeight:'260px',overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.15)',left:0}}>
          {results.map(r => (
            <li
              key={r.sp_no}
              onClick={() => {
                onChange(r.sp_no, r.species)
                setQuery(r.species)
                setLoadedName(r.species)
                setOpen(false)
                setResults([])
              }}
              style={{padding:'14px 16px',borderBottom:'1px solid #f3efe2',cursor:'pointer',fontSize:'15px',lineHeight:'1.4'}}
            >
              <span style={{ fontWeight: 600 }}>{r.species}</span>
              {r.common_name && r.common_name !== 'Unknown' && (
                <span style={{ color: '#8a7f5f' }}> — {r.common_name}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function VariantAutocomplete({ spNo, value, onChange }: { spNo: number | null, value: string, onChange: (name: string, variantSpNo: number | null) => void }) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => { setQuery(value || '') }, [value])
useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      setOpen(false)
    }
    if (open) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [open])
  useEffect(() => {
    if (!spNo || !query.trim()) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('variants')
        .select('sp_no, variant_name')
        .eq('parent_sp_no', spNo)
        .ilike('variant_name', `%${query}%`)
        .limit(50)
      setResults(data || [])
    }, 250)
    return () => clearTimeout(timeout)
  }, [query, spNo])

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value, null); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={spNo ? "Type to search known variants..." : "Select a species first"}
        disabled={!spNo}
        style={inputStyle}
      />
      {open && results.length > 0 && (
      <ul style={{position:'absolute',zIndex:999,background:'#fffefb',border:'1px solid #e2dac2',borderRadius:'12px',marginTop:'4px',width:'100%',maxHeight:'260px',overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.15)',left:0}}>
          {results.map((r, i) => (
            <li
              key={i}
              onClick={() => { onChange(r.variant_name, r.sp_no); setQuery(r.variant_name); setOpen(false); setResults([]) }}
              style={{padding:'14px 16px',borderBottom:'1px solid #f3efe2',cursor:'pointer',fontSize:'15px',lineHeight:'1.4'}}
            >
              {r.variant_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function VariantCareInfo({ variantSpNo }: { variantSpNo: number | null | undefined }) {
  const [care, setCare] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!variantSpNo) { setCare(null); return }
    setLoading(true)
    supabase
      .from('variant_effective_care')
      .select('effective_watering, effective_soil_mix, effective_repotting, effective_fertilising, effective_winter_care, effective_species_notes')
      .eq('sp_no', variantSpNo)
      .single()
      .then(({ data }) => { setCare(data); setLoading(false) })
  }, [variantSpNo])

  if (!variantSpNo) return null
  if (loading) return <p style={{ fontSize: '13px', color: '#a89e7a', marginTop: '6px' }}>Loading variant care info...</p>
  if (!care) return <p style={{ fontSize: '13px', color: '#b45309', marginTop: '6px' }}>No specific care data recorded for this variant yet — using species-level defaults.</p>

  return (
    <div style={{ marginTop: '10px', padding: '14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <p style={{ fontWeight: 600, color: '#92400e', marginBottom: '4px' }}>Variant-specific care</p>
      {care.effective_watering && <p><span style={{ color: '#8a7f5f' }}>Watering: </span>{care.effective_watering}</p>}
      {care.effective_soil_mix && <p><span style={{ color: '#8a7f5f' }}>Soil mix: </span>{care.effective_soil_mix}</p>}
      {care.effective_repotting && <p><span style={{ color: '#8a7f5f' }}>Repotting cycle: </span>{care.effective_repotting}</p>}
      {care.effective_fertilising && <p><span style={{ color: '#8a7f5f' }}>Fertilising: </span>{care.effective_fertilising}</p>}
      {care.effective_winter_care && <p><span style={{ color: '#8a7f5f' }}>Winter care: </span>{care.effective_winter_care}</p>}
      {care.effective_species_notes && <p><span style={{ color: '#8a7f5f' }}>Notes: </span>{care.effective_species_notes}</p>}
    </div>
  )
}

function formatVal(v: any): string {
  if (v === null || v === undefined || v === '') return '— not set —'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

export default function CollectionDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [tree, setTree] = useState<any>(null)
  const [speciesName, setSpeciesName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)

  useEffect(() => {
    fetchTree()
  }, [id])

  async function fetchTree() {
    setLoading(true)
    const { data, error } = await supabase
      .from('collection')
      .select('*')
      .eq('collection_id', id)
      .single()

    if (error) {
      alert('Error loading tree: ' + error.message)
    }
    setTree(data)

    if (data?.variant_sp_no) {
      const { data: v } = await supabase.from('variants').select('variant_name, common_name').eq('sp_no', data.variant_sp_no).single()
      if (v) setSpeciesName(`${v.variant_name}${v.common_name && v.common_name !== 'Unknown' ? ' — ' + v.common_name : ''}`)
    } else if (data?.sp_no) {
      const { data: sp } = await supabase.from('species').select('species, common_name').eq('sp_no', data.sp_no).single()
      if (sp) setSpeciesName(`${sp.species}${sp.common_name && sp.common_name !== 'Unknown' ? ' — ' + sp.common_name : ''}`)
    }

    setLoading(false)
  }

  function set(field: string, value: any) {
    setTree((prev: any) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    if (!tree) return
    const baseSpecies = (speciesName || '').split(' — ')[0]
    const computed = [baseSpecies, tree.tree_number].filter(Boolean).join(' ')
    if (computed && computed !== tree.display_name) {
      setTree((prev: any) => prev ? { ...prev, display_name: computed } : prev)
    }
  }, [speciesName, tree?.tree_number])

  async function handleSave() {
    setSaving(true)
    const { collection_id, created_at, updated_at, ...updateData } = tree
    updateData.in_collection = true
    updateData.collection_id = id

    const res = await fetch('/api/collection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    })
    const data = await res.json()

    setSaving(false)

    if (!res.ok) {
      alert('Error saving: ' + data.error)
    } else {
      alert('Saved')
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this tree permanently?')) return
    const res = await fetch(`/api/collection?id=${id}`, { method: 'DELETE' })
    const data = await res.json()

    if (!res.ok) {
      alert('Error deleting: ' + data.error)
      return
    }
    window.location.href = '/collection'
  }

  function isOverdue(dateStr: string | null) {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  async function handleGenerateReport() {
    setGeneratingReport(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 40
      let y = 40

      let logoDataUrl: string | null = null
      try {
        const res = await fetch('/logo.png')
        const blob = await res.blob()
        logoDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      } catch (e) {
        console.warn('Logo failed to load', e)
      }

      if (logoDataUrl) {
        const logoSize = 60
        doc.addImage(logoDataUrl, 'PNG', margin, y, logoSize, logoSize)
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text('Bonsai Australis', margin + logoSize + 15, y + 28)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text('Collection Report', margin + logoSize + 15, y + 46)
        y += logoSize + 25
      } else {
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text('Bonsai Australis — Collection Report', margin, y + 10)
        y += 35
      }

      doc.setDrawColor(180)
      doc.line(margin, y, pageWidth - margin, y)
      y += 20

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(tree.display_name || 'Unnamed Tree', margin, y)
      y += 18

      if (tree.tree_name) {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'italic')
        doc.text(`"${tree.tree_name}"`, margin, y)
        y += 16
      }

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`Tree Number: ${formatVal(tree.tree_number)}`, margin, y)
      y += 14
      doc.text(`Species: ${speciesName || '— not set —'}`, margin, y)
      y += 14
      if (tree.variation_or_cultivar) {
        doc.text(`Variation/Cultivar: ${tree.variation_or_cultivar}`, margin, y)
        y += 14
      }
      y += 10

      let variantCare: any = null
      if (tree.variant_sp_no) {
        const { data: vc } = await supabase
          .from('variant_effective_care')
          .select('effective_watering, effective_soil_mix, effective_repotting, effective_fertilising, effective_winter_care, effective_species_notes')
          .eq('sp_no', tree.variant_sp_no)
          .single()
        variantCare = vc
      }

      let suitability: any = null
      if (tree.sp_no) {
        const { data: sd } = await supabase
          .from('bonsai_suitability')
          .select('bonsai_suitability, difficulty, recommended_bonsai_styles, vigor, back_budding_ability, ramification_potential, leaf_reduction_potential, root_tolerance_score, wire_bend_tolerance, nebari_potential_score, bark_character_score, taper_movement_score, longevity_score, native_bonus, final_bonsai_score, bonsai_tier, research_status, needs_verification')
          .eq('sp_no', tree.sp_no)
          .single()
        suitability = sd
      }

      function checkPageBreak(needed: number) {
        if (y + needed > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage()
          y = 40
        }
      }

      function addSection(title: string, fields: [string, any][]) {
        checkPageBreak(30)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.setFillColor(245, 245, 245)
        doc.rect(margin, y - 12, pageWidth - margin * 2, 18, 'F')
        doc.text(title, margin + 5, y)
        y += 20
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')

        fields.forEach(([label, value]) => {
          const formatted = formatVal(value)
          const isEmpty = formatted === '— not set —'
          const lines = doc.splitTextToSize(formatted, pageWidth - margin * 2 - 160)
          checkPageBreak(14 * lines.length + 4)
          doc.setTextColor(60, 60, 60)
          doc.text(`${label}:`, margin + 5, y)
          if (isEmpty) {
            doc.setTextColor(180, 180, 180)
          } else {
            doc.setTextColor(20, 20, 20)
          }
          doc.text(lines, margin + 160, y)
          y += 14 * lines.length
        })
        doc.setTextColor(0, 0, 0)
        y += 8
      }

      addSection('Origin & Provenance', [
        ['Origin Material', tree.origin_material],
        ['Source', tree.source],
        ['Acquired Date', tree.acquired_date],
        ['Origin Tubestock Tag', tree.origin_tubestock_tag],
        ['Year Est. Planted', tree.year_est_planted],
        ['Estimated Age', tree.estimated_age],
      ])

      if (suitability) {
        const confidenceLabel = suitability.needs_verification
          ? 'Provisional / Family Default'
          : (suitability.research_status || 'Verified')
        addSection('Bonsai Suitability Profile', [
          ['Overall Suitability', suitability.bonsai_suitability],
          ['Suitability Tier', suitability.bonsai_tier],
          ['Final Score', suitability.final_bonsai_score],
          ['Difficulty', suitability.difficulty],
          ['Confidence', confidenceLabel],
          ['Recommended Styles', suitability.recommended_bonsai_styles],
          ['Vigor', suitability.vigor],
          ['Back Budding', suitability.back_budding_ability],
          ['Ramification Potential', suitability.ramification_potential],
          ['Leaf Reduction Potential', suitability.leaf_reduction_potential],
          ['Root Tolerance', suitability.root_tolerance_score],
          ['Wire/Bend Tolerance', suitability.wire_bend_tolerance],
          ['Nebari Potential', suitability.nebari_potential_score],
          ['Bark Character', suitability.bark_character_score],
          ['Taper & Movement', suitability.taper_movement_score],
          ['Longevity', suitability.longevity_score],
          ['Native Bonus', suitability.native_bonus],
        ])
      }

      if (variantCare) {
        addSection('Variant-Specific Care', [
          ['Watering', variantCare.effective_watering],
          ['Soil Mix', variantCare.effective_soil_mix],
          ['Repotting Cycle', variantCare.effective_repotting],
          ['Fertilising', variantCare.effective_fertilising],
          ['Winter Care', variantCare.effective_winter_care],
          ['Notes', variantCare.effective_species_notes],
        ])
      }

      addSection('Development & Styling', [
        ['Style', tree.style],
        ['Development Stage', tree.development_stage],
        ['Training Stage', tree.training_stage],
        ['Origin Material', tree.origin_material],
        ['Year Est. Planted', tree.year_est_planted],
        ['Estimated Age', tree.estimated_age],
        ['Plan', tree.plan],
        ['Intended Look', tree.intended_look],
        ['Work Plan', tree.work_plan],
      ])

      addSection('Commercial', [
        ['Source', tree.source],
        ['Acquired Date', tree.acquired_date],
        ['Pot Price', tree.pot_price],
        ['Price Paid', tree.price_paid],
        ['Estimated Value', tree.estimated_value],
        ['For Sale', tree.for_sale],
        ['Sale Price', tree.sale_price],
        ['Sold Price', tree.sold_price],
      ])

      addSection('Location & Display', [
        ['Location', tree.location],
        ['Bench Position', tree.bench_position],
        ['Display Status', tree.display_status],
      ])

      addSection('Growing Medium', [
        ['Pot Size', tree.pot_size],
        ['Pot Type', tree.pot_type],
        ['Best Soil Mix', tree.best_soil_mix],
        ['Soil Mix Used', tree.soil_mix_used],
      ])

      addSection('Care Schedule', [
        ['Last Watered', tree.last_watered],
        ['Last Fertilised', tree.last_fertilised],
        ['Next Fertilise Due', tree.next_fertilise_due],
        ['Last Repotted', tree.last_repotted],
        ['Next Repot Due', tree.next_repot_due],
        ['Last Pruned', tree.last_pruned],
        ['Due Prune Date', tree.due_prune_date],
        ['Date Wired', tree.date_wired],
        ['Date Check Wire', tree.date_check_wire],
      ])

      addSection('Physical Details', [
        ['Height (mm)', tree.height_mm],
        ['Trunk Thickness (mm)', tree.trunk_thickness_mm],
        ['Canopy Width (mm)', tree.canopy_width_mm],
        ['Weight (kg)', tree.weight_kg],
      ])

      addSection('Notes', [
        ['Quick Notes', tree.notes],
        ['Extended Notes', tree.notes_collection],
      ])

      const fileName = (tree.display_name || 'tree').replace(/[^a-z0-9]+/gi, '_').toLowerCase()
      doc.save(`${fileName}_report.pdf`)
    } catch (e: any) {
      alert('Error generating report: ' + e.message)
    } finally {
      setGeneratingReport(false)
    }
  }

  if (loading) {
    return <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 16px' }}><p style={{ color: '#a89e7a', fontSize: '15px' }}>Loading...</p></main>
  }

  if (!tree) {
    return <main style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 16px' }}><p style={{ color: '#dc2626', fontSize: '15px' }}>Tree not found.</p></main>
  }

  return (
    <main style={{ width: '100%', boxSizing: 'border-box', maxWidth: '1200px', margin: '0 auto', padding: '24px 24px 112px', background: '#faf7f1', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <a href="/collection" style={{ fontSize: '14px', color: '#5c7a2a', fontWeight: 600, textDecoration: 'none' }}>&larr; Back to Collection</a>
        <button
          type="button"
          onClick={handleGenerateReport}
          disabled={generatingReport}
          style={{ fontSize: '13px', background: '#3f5228', color: '#fdfaf3', padding: '9px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: generatingReport ? 0.5 : 1, fontWeight: 600 }}
        >
          {generatingReport ? 'Generating...' : '📄 PDF Report'}
        </button>
      </div>

      <HeroPhotoField value={tree.image_url || ''} onChange={v => set('image_url', v)} />

      {/* Identity header - always visible */}
      <div style={{ marginBottom: '18px' }}>
        <h1 style={{ width: '100%', fontSize: '32px', fontWeight: 700, color: '#2b2620', borderBottom: '1px solid #e2dac2', paddingBottom: '10px', marginBottom: '2px', letterSpacing: '-0.01em' }}>
          {tree.display_name || 'Unnamed Tree'}
        </h1>
        <p style={{ fontSize: '13px', color: '#a89e7a', margin: '0 0 8px' }}>
          sp_no: {tree.sp_no ?? '— not set —'}
          {tree.variant_sp_no ? ` · variant sp_no: ${tree.variant_sp_no}` : ''}
        </p>
        <input
          type="text"
          value={tree.tree_name || ''}
          onChange={e => set('tree_name', e.target.value)}
          placeholder="Tree name / nickname"
          style={{ width: '100%', fontSize: '15px', color: '#8a7f5f', border: 'none', borderBottom: '1px solid #e2dac2', paddingBottom: '6px', background: 'transparent', outline: 'none' }}
        />
      </div>

      {/* Status badges */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <select value={tree.status || ''} onChange={e => set('status', e.target.value)} style={{ fontSize: '14px', border: '1.5px solid #e2dac2', borderRadius: '8px', padding: '8px 12px', background: '#fffefb', color: '#2b2620' }}>
          <option value="">Status...</option>
          <option value="Developing">Developing</option>
          <option value="Refining">Refining</option>
          <option value="Show Ready">Show Ready</option>
          <option value="Maintenance">Maintenance</option>
        </select>
        <select value={tree.health_status || ''} onChange={e => set('health_status', e.target.value)} style={{ fontSize: '14px', border: '1.5px solid #e2dac2', borderRadius: '8px', padding: '8px 12px', background: '#fffefb', color: '#2b2620' }}>
          <option value="">Health...</option>
          <option value="Excellent">Excellent</option>
          <option value="Good">Good</option>
          <option value="Stressed">Stressed</option>
          <option value="Recovering">Recovering</option>
          <option value="Critical">Critical</option>
        </select>
        <select value={tree.vigor || ''} onChange={e => set('vigor', e.target.value)} style={{ fontSize: '14px', border: '1.5px solid #e2dac2', borderRadius: '8px', padding: '8px 12px', background: '#fffefb', color: '#2b2620' }}>
          <option value="">Vigor...</option>
          <option value="Low">Low</option>
          <option value="Moderate">Moderate</option>
          <option value="Strong">Strong</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#2b2620' }}>
          <input type="checkbox" checked={!!tree.in_collection} onChange={e => set('in_collection', e.target.checked)} style={{ width: '17px', height: '17px' }} />
          In collection
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#2b2620' }}>
          <input type="checkbox" checked={!!tree.is_favourite} onChange={e => set('is_favourite', e.target.checked)} style={{ width: '17px', height: '17px' }} />
          Favourite
        </label>
      </div>

      {/* Quick notes - always visible at top */}
      <Field label="Quick Notes">
        <textarea
          value={tree.notes || ''}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
          placeholder="Voice-to-text friendly quick notes..."
        />
      </Field>

      <div style={{ marginTop: '18px' }}>
        <Section title="Development & Styling" defaultOpen>
          <Field label="Tree Number"><input type="number" value={tree.tree_number ?? ''} onChange={e => set('tree_number', e.target.value ? parseInt(e.target.value) : null)} style={inputStyle} /></Field>
          <Field label="Species">
            <SpeciesAutocomplete value={tree.sp_no} onChange={(spNo, name) => { set('sp_no', spNo); setSpeciesName(name) }} />
          </Field>
          <Field label="Variation / Cultivar">
            <VariantAutocomplete
              spNo={tree.sp_no}
              value={tree.variation_or_cultivar || ''}
              onChange={(val, variantSpNo) => {
                set('variation_or_cultivar', val)
                set('variant_sp_no', variantSpNo)
              }}
            />
            <VariantCareInfo variantSpNo={tree.variant_sp_no} />
          </Field>
          <Field label="Style"><Dropdown value={tree.style} onChange={v => set('style', v)} options={STYLE_OPTIONS} category="style" /></Field>
          <Field label="Development Stage"><Dropdown value={tree.development_stage} onChange={v => set('development_stage', v)} options={DEV_STAGE_OPTIONS} category="development_stage" /></Field>
          <Field label="Training Stage"><Dropdown value={tree.training_stage} onChange={v => set('training_stage', v)} options={TRAINING_STAGE_OPTIONS} category="training_stage" /></Field>
          <Field label="Origin Material"><Dropdown value={tree.origin_material} onChange={v => set('origin_material', v)} options={ORIGIN_MATERIAL_OPTIONS} category="origin_material" /></Field>
          <Field label="Origin Tubestock Tag">
            <input
              type="text"
              value={tree.origin_tubestock_tag || ''}
              onChange={e => set('origin_tubestock_tag', e.target.value)}
              placeholder="e.g. TS0007/003"
              style={inputStyle}
            />
          </Field>
          <Field label="Year Est. Planted">
            <input
              type="number"
              value={tree.year_est_planted || ''}
              onChange={e => set('year_est_planted', e.target.value)}
              placeholder="e.g. 1995"
              min="1900"
              max={new Date().getFullYear()}
              style={inputStyle}
            />
            {tree.year_est_planted && /^\d{4}$/.test(String(tree.year_est_planted)) && (
              <p style={{ fontSize: "12px", color: "#a89e7a", marginTop: "6px" }}>
                ≈ {new Date().getFullYear() - parseInt(tree.year_est_planted)} years old
              </p>
            )}
          </Field>
          <Field label="Estimated Age"><input type="text" value={tree.estimated_age || ''} onChange={e => set('estimated_age', e.target.value)} style={inputStyle} /></Field>
          <Field label="Plan"><textarea value={tree.plan || ''} onChange={e => set('plan', e.target.value)} rows={2} style={inputStyle} /></Field>
         <Field label="Intended Look"><textarea value={tree.intended_look || ''} onChange={e => set('intended_look', e.target.value)} rows={2} style={inputStyle} /></Field>
          <PhotoField label="Inspiration Photo" value={tree.inspiration_photo || ''} onChange={v => set('inspiration_photo', v)} />
          <Field label="Work Plan"><textarea value={tree.work_plan || ''} onChange={e => set('work_plan', e.target.value)} rows={2} style={inputStyle} /></Field>
        </Section>

        <Section title="Commercial">
          <Field label="Source"><Dropdown value={tree.source} onChange={v => set('source', v)} options={SOURCE_OPTIONS} category="source" /></Field>
          <Field label="Acquired Date"><input type="date" value={tree.acquired_date || ''} onChange={e => set('acquired_date', e.target.value)} style={inputStyle} /></Field>
          <Field label="Pot Price"><input type="number" value={tree.pot_price || ''} onChange={e => set('pot_price', e.target.value ? parseFloat(e.target.value) : null)} style={inputStyle} /></Field>
          <Field label="Price Paid"><input type="number" value={tree.price_paid || ''} onChange={e => set('price_paid', e.target.value ? parseFloat(e.target.value) : null)} style={inputStyle} /></Field>
          <Field label="Estimated Value"><input type="number" value={tree.estimated_value || ''} onChange={e => set('estimated_value', e.target.value ? parseFloat(e.target.value) : null)} style={inputStyle} /></Field>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px", color: "#2b2620" }}>
            <input type="checkbox" checked={!!tree.for_sale} onChange={e => set('for_sale', e.target.checked)} />
            For Sale
          </label>
          <Field label="Sale Price"><input type="number" value={tree.sale_price || ''} onChange={e => set('sale_price', e.target.value ? parseFloat(e.target.value) : null)} style={inputStyle} /></Field>
          <Field label="Sold Price"><input type="number" value={tree.sold_price || ''} onChange={e => set('sold_price', e.target.value ? parseFloat(e.target.value) : null)} style={inputStyle} /></Field>
          <Field label="Customer Facing Wording"><textarea value={tree.customer_facing_wording || ''} onChange={e => set('customer_facing_wording', e.target.value)} rows={2} style={inputStyle} /></Field>
        </Section>

        <Section title="Location & Display">
          <Field label="Location"><input type="text" value={tree.location || ''} onChange={e => set('location', e.target.value)} style={inputStyle} /></Field>
          <Field label="Bench Position"><input type="text" value={tree.bench_position || ''} onChange={e => set('bench_position', e.target.value)} style={inputStyle} /></Field>
          <Field label="Display Status"><input type="text" value={tree.display_status || ''} onChange={e => set('display_status', e.target.value)} style={inputStyle} /></Field>
        </Section>

        <Section title="Media & Notes">
          <PhotoField label="Photo 2" value={tree.photo_1 || ''} onChange={v => set('photo_1', v)} />
          <PhotoField label="Photo 3" value={tree.photo_2 || ''} onChange={v => set('photo_2', v)} />
          <PhotoField label="Photo 4" value={tree.photo_3 || ''} onChange={v => set('photo_3', v)} />
          <Field label="External Documents"><input type="text" value={tree.external_documents || ''} onChange={e => set('external_documents', e.target.value)} style={inputStyle} /></Field>
          <Field label="Blog Link"><input type="text" value={tree.blog_link || ''} onChange={e => set('blog_link', e.target.value)} style={inputStyle} /></Field>
          <Field label="Notes (extended)"><textarea value={tree.notes_collection || ''} onChange={e => set('notes_collection', e.target.value)} rows={3} style={inputStyle} /></Field>
        </Section>

        <Section title="Growing Medium">
          <Field label="Pot Size"><input type="text" value={tree.pot_size || ''} onChange={e => set('pot_size', e.target.value)} style={inputStyle} /></Field>
          <Field label="Pot Type"><input type="text" value={tree.pot_type || ''} onChange={e => set('pot_type', e.target.value)} style={inputStyle} /></Field>
          <Field label="Best Soil Mix"><input type="text" value={tree.best_soil_mix || ''} onChange={e => set('best_soil_mix', e.target.value)} style={inputStyle} /></Field>
          <Field label="Soil Mix Used"><input type="text" value={tree.soil_mix_used || ''} onChange={e => set('soil_mix_used', e.target.value)} style={inputStyle} /></Field>
        </Section>

        <Section title="Care Schedule">
          <Field label="Last Watered"><input type="date" value={tree.last_watered || ''} onChange={e => set('last_watered', e.target.value)} style={inputStyle} /></Field>
          <div />
          <Field label="Last Fertilised"><input type="date" value={tree.last_fertilised || ''} onChange={e => set('last_fertilised', e.target.value)} style={inputStyle} /></Field>
          <Field label="Next Fertilise Due">
            <input type="date" value={tree.next_fertilise_due || ''} onChange={e => set('next_fertilise_due', e.target.value)}
              style={isOverdue(tree.next_fertilise_due) ? overdueInputStyle : inputStyle} />
          </Field>
          <Field label="Last Repotted"><input type="date" value={tree.last_repotted || ''} onChange={e => set('last_repotted', e.target.value)} style={inputStyle} /></Field>
          <Field label="Next Repot Due">
            <input type="date" value={tree.next_repot_due || ''} onChange={e => set('next_repot_due', e.target.value)}
              style={isOverdue(tree.next_repot_due) ? overdueInputStyle : inputStyle} />
          </Field>
          <Field label="Last Pruned"><input type="date" value={tree.last_pruned || ''} onChange={e => set('last_pruned', e.target.value)} style={inputStyle} /></Field>
          <Field label="Due Prune Date">
            <input type="date" value={tree.due_prune_date || ''} onChange={e => set('due_prune_date', e.target.value)}
              style={isOverdue(tree.due_prune_date) ? overdueInputStyle : inputStyle} />
          </Field>
          <Field label="Date Wired"><input type="date" value={tree.date_wired || ''} onChange={e => set('date_wired', e.target.value)} style={inputStyle} /></Field>
          <Field label="Date Check Wire">
            <input type="date" value={tree.date_check_wire || ''} onChange={e => set('date_check_wire', e.target.value)}
              style={isOverdue(tree.date_check_wire) ? overdueInputStyle : inputStyle} />
          </Field>
        </Section>

        <Section title="Physical Details">
          <Field label="Height (mm)"><input type="number" value={tree.height_mm || ''} onChange={e => set('height_mm', e.target.value ? parseFloat(e.target.value) : null)} style={inputStyle} /></Field>
          <Field label="Trunk Thickness (mm)"><input type="number" value={tree.trunk_thickness_mm || ''} onChange={e => set('trunk_thickness_mm', e.target.value ? parseFloat(e.target.value) : null)} style={inputStyle} /></Field>
          <Field label="Canopy Width (mm)"><input type="number" value={tree.canopy_width_mm || ''} onChange={e => set('canopy_width_mm', e.target.value ? parseFloat(e.target.value) : null)} style={inputStyle} /></Field>
          <Field label="Weight (kg)"><input type="number" value={tree.weight_kg || ''} onChange={e => set('weight_kg', e.target.value ? parseFloat(e.target.value) : null)} style={inputStyle} /></Field>
        </Section>

        <Section title="Journal">
          <JournalSection collectionId={id} spNo={tree.sp_no} />
        </Section>

        <button
          type="button"
          onClick={handleDelete}
          style={{ color: '#c04545', fontSize: '14px', marginTop: '10px', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Delete this tree
        </button>
      </div>

      {/* Save button - normal flow, not fixed */}
      <div style={{ marginTop: '24px', marginBottom: '40px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: '#3f5228', color: '#fdfaf3', padding: '16px 24px', borderRadius: '12px', fontWeight: 700, width: '100%', fontSize: '17px', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1, boxShadow: '0 2px 10px rgba(63,82,40,0.2)' }}
        >
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>
    </main>
  )
}
