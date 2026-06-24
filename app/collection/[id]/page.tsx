'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

function Section({ title, defaultOpen, children }: { title: string, defaultOpen?: boolean, children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="border rounded-lg mb-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-4 py-3 font-semibold text-left"
      >
        {title}
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>}
    </div>
  )
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-500 block mb-1">{label}</span>
      {children}
    </label>
  )
}

const inputClass = "w-full border rounded px-4 py-3 text-base min-h-[48px]"

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
      <div className="flex gap-2">
        <input
          type="text"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder="New option..."
          className={inputClass}
          autoFocus
        />
        <button type="button" onClick={handleAdd} className="bg-blue-600 text-white px-3 rounded text-sm">Add</button>
        <button type="button" onClick={() => setAdding(false)} className="text-gray-400 px-2 text-sm">✕</button>
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
      className={inputClass}
    >
      <option value="">Select...</option>
      {allOptions.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__add_new__">+ Add new option...</option>
    </select>
  )
}

function PhotoField({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false)
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
      <span className="text-gray-500 block mb-1 text-sm">{label}</span>
      {value && (
        <img src={value} alt={label} className="w-full max-h-48 object-cover rounded mb-2 border" />
      )}
      <div className="flex gap-2">
        <label htmlFor={inputId} className="flex-1 text-center bg-gray-100 border rounded px-3 py-2 text-sm cursor-pointer">
          {uploading ? 'Uploading...' : value ? '📷 Replace Photo' : '📷 Add Photo'}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
          disabled={uploading}
        />
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-red-500 text-sm px-2">✕</button>
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
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(null, '') }}
        onFocus={() => setOpen(true)}
        placeholder="Search species name..."
        className={inputClass}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 bg-white border rounded mt-1 w-full max-h-48 overflow-y-auto shadow-lg">
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
              className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-base border-b last:border-0 min-h-[48px] flex items-center gap-2"
            >
              <span className="font-medium">{r.species}</span>
              {r.common_name && r.common_name !== 'Unknown' && (
                <span className="text-gray-500"> — {r.common_name}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function VariantAutocomplete({ spNo, value, onChange }: { spNo: number | null, value: string, onChange: (name: string) => void }) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => { setQuery(value || '') }, [value])

  useEffect(() => {
    if (!spNo || !query.trim()) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('variants')
        .select('variant_name')
        .eq('parent_sp_no', spNo)
        .ilike('variant_name', `%${query}%`)
        .limit(50)
      setResults(data || [])
    }, 250)
    return () => clearTimeout(timeout)
  }, [query, spNo])

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={spNo ? "Type to search known variants..." : "Select a species first"}
        disabled={!spNo}
        className={inputClass}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 bg-white border rounded mt-1 w-full max-h-64 overflow-y-auto shadow-lg">
          {results.map((r, i) => (
            <li
              key={i}
              onClick={() => { onChange(r.variant_name); setQuery(r.variant_name); setOpen(false); setResults([]) }}
              className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-base border-b last:border-0 min-h-[48px] flex items-center"
            >
              {r.variant_name}
            </li>
          ))}
        </ul>
      )}
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

    if (data?.sp_no) {
      const { data: sp } = await supabase.from('species').select('species, common_name').eq('sp_no', data.sp_no).single()
      if (sp) setSpeciesName(`${sp.species}${sp.common_name && sp.common_name !== 'Unknown' ? ' — ' + sp.common_name : ''}`)
    }

    setLoading(false)
  }

  function set(field: string, value: any) {
    setTree((prev: any) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const { collection_id, created_at, updated_at, ...updateData } = tree

    const { error } = await supabase
      .from('collection')
      .update(updateData)
      .eq('collection_id', id)

    setSaving(false)

    if (error) {
      alert('Error saving: ' + error.message)
    } else {
      alert('Saved')
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this tree permanently?')) return
    const { error } = await supabase
      .from('collection')
      .delete()
      .eq('collection_id', id)

    if (error) {
      alert('Error deleting: ' + error.message)
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
    return <main className="max-w-2xl mx-auto px-4 py-8"><p className="text-gray-400">Loading...</p></main>
  }

  if (!tree) {
    return <main className="max-w-2xl mx-auto px-4 py-8"><p className="text-red-500">Tree not found.</p></main>
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 pb-28">
      <div className="flex justify-between items-center mb-4">
        <a href="/collection" className="text-sm text-blue-600">&larr; Back to Collection</a>
        <button
          type="button"
          onClick={handleGenerateReport}
          disabled={generatingReport}
          className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded disabled:opacity-50"
        >
          {generatingReport ? 'Generating...' : '📄 PDF Report'}
        </button>
      </div>

      {/* Identity header - always visible */}
      <div className="mb-4">
        <input
          type="text"
          value={tree.display_name || ''}
          onChange={e => set('display_name', e.target.value)}
          placeholder="Display name"
          className="w-full text-2xl font-bold border-b pb-2 mb-2"
        />
        <input
          type="text"
          value={tree.tree_name || ''}
          onChange={e => set('tree_name', e.target.value)}
          placeholder="Tree name / nickname"
          className="w-full text-sm text-gray-500 border-b pb-1"
        />
      </div>

      {/* Status badges */}
      <div className="flex gap-2 flex-wrap mb-4">
        <select value={tree.status || ''} onChange={e => set('status', e.target.value)} className="text-xs border rounded px-2 py-1">
          <option value="">Status...</option>
          <option value="Developing">Developing</option>
          <option value="Refining">Refining</option>
          <option value="Show Ready">Show Ready</option>
          <option value="Maintenance">Maintenance</option>
        </select>
        <select value={tree.health_status || ''} onChange={e => set('health_status', e.target.value)} className="text-xs border rounded px-2 py-1">
          <option value="">Health...</option>
          <option value="Excellent">Excellent</option>
          <option value="Good">Good</option>
          <option value="Stressed">Stressed</option>
          <option value="Recovering">Recovering</option>
          <option value="Critical">Critical</option>
        </select>
        <select value={tree.vigor || ''} onChange={e => set('vigor', e.target.value)} className="text-xs border rounded px-2 py-1">
          <option value="">Vigor...</option>
          <option value="Low">Low</option>
          <option value="Moderate">Moderate</option>
          <option value="Strong">Strong</option>
        </select>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={!!tree.in_collection} onChange={e => set('in_collection', e.target.checked)} />
          In collection
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={!!tree.is_favourite} onChange={e => set('is_favourite', e.target.checked)} />
          Favourite
        </label>
      </div>

      {/* Quick notes - always visible at top */}
      <Field label="Quick Notes">
        <textarea
          value={tree.notes || ''}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          className={inputClass}
          placeholder="Voice-to-text friendly quick notes..."
        />
      </Field>

      <div className="mt-4">
        <Section title="Development & Styling" defaultOpen>
          <Field label="Tree Number"><input type="number" value={tree.tree_number ?? ''} onChange={e => set('tree_number', e.target.value ? parseInt(e.target.value) : null)} className={inputClass} /></Field>
          <Field label="Species">
            <SpeciesAutocomplete value={tree.sp_no} onChange={(spNo, name) => { set('sp_no', spNo); setSpeciesName(name) }} />
          </Field>
          <Field label="Variation / Cultivar">
            <VariantAutocomplete spNo={tree.sp_no} value={tree.variation_or_cultivar || ''} onChange={val => set('variation_or_cultivar', val)} />
          </Field>
          <Field label="Style"><Dropdown value={tree.style} onChange={v => set('style', v)} options={STYLE_OPTIONS} category="style" /></Field>
          <Field label="Development Stage"><Dropdown value={tree.development_stage} onChange={v => set('development_stage', v)} options={DEV_STAGE_OPTIONS} category="development_stage" /></Field>
          <Field label="Training Stage"><Dropdown value={tree.training_stage} onChange={v => set('training_stage', v)} options={TRAINING_STAGE_OPTIONS} category="training_stage" /></Field>
          <Field label="Origin Material"><Dropdown value={tree.origin_material} onChange={v => set('origin_material', v)} options={ORIGIN_MATERIAL_OPTIONS} category="origin_material" /></Field>
          <Field label="Year Est. Planted">
            <input
              type="number"
              value={tree.year_est_planted || ''}
              onChange={e => set('year_est_planted', e.target.value)}
              placeholder="e.g. 1995"
              min="1900"
              max={new Date().getFullYear()}
              className={inputClass}
            />
            {tree.year_est_planted && /^\d{4}$/.test(String(tree.year_est_planted)) && (
              <p className="text-xs text-gray-500 mt-1">
                ≈ {new Date().getFullYear() - parseInt(tree.year_est_planted)} years old
              </p>
            )}
          </Field>
          <Field label="Estimated Age"><input type="text" value={tree.estimated_age || ''} onChange={e => set('estimated_age', e.target.value)} className={inputClass} /></Field>
          <Field label="Plan"><textarea value={tree.plan || ''} onChange={e => set('plan', e.target.value)} rows={2} className={inputClass} /></Field>
         <Field label="Intended Look"><textarea value={tree.intended_look || ''} onChange={e => set('intended_look', e.target.value)} rows={2} className={inputClass} /></Field>
          <PhotoField label="Inspiration Photo" value={tree.inspiration_photo || ''} onChange={v => set('inspiration_photo', v)} />
          <Field label="Work Plan"><textarea value={tree.work_plan || ''} onChange={e => set('work_plan', e.target.value)} rows={2} className={inputClass} /></Field>
        </Section>

        <Section title="Commercial">
          <Field label="Source"><Dropdown value={tree.source} onChange={v => set('source', v)} options={SOURCE_OPTIONS} category="source" /></Field>
          <Field label="Acquired Date"><input type="date" value={tree.acquired_date || ''} onChange={e => set('acquired_date', e.target.value)} className={inputClass} /></Field>
          <Field label="Pot Price"><input type="number" value={tree.pot_price || ''} onChange={e => set('pot_price', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
          <Field label="Price Paid"><input type="number" value={tree.price_paid || ''} onChange={e => set('price_paid', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
          <Field label="Estimated Value"><input type="number" value={tree.estimated_value || ''} onChange={e => set('estimated_value', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!tree.for_sale} onChange={e => set('for_sale', e.target.checked)} />
            For Sale
          </label>
          <Field label="Sale Price"><input type="number" value={tree.sale_price || ''} onChange={e => set('sale_price', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
          <Field label="Sold Price"><input type="number" value={tree.sold_price || ''} onChange={e => set('sold_price', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
          <Field label="Customer Facing Wording"><textarea value={tree.customer_facing_wording || ''} onChange={e => set('customer_facing_wording', e.target.value)} rows={2} className={inputClass} /></Field>
        </Section>

        <Section title="Location & Display">
          <Field label="Location"><input type="text" value={tree.location || ''} onChange={e => set('location', e.target.value)} className={inputClass} /></Field>
          <Field label="Bench Position"><input type="text" value={tree.bench_position || ''} onChange={e => set('bench_position', e.target.value)} className={inputClass} /></Field>
          <Field label="Display Status"><input type="text" value={tree.display_status || ''} onChange={e => set('display_status', e.target.value)} className={inputClass} /></Field>
        </Section>

        <Section title="Media & Notes">
          <PhotoField label="Primary Photo" value={tree.image_url || ''} onChange={v => set('image_url', v)} />
          <PhotoField label="Photo 2" value={tree.photo_1 || ''} onChange={v => set('photo_1', v)} />
          <PhotoField label="Photo 3" value={tree.photo_2 || ''} onChange={v => set('photo_2', v)} />
          <PhotoField label="Photo 4" value={tree.photo_3 || ''} onChange={v => set('photo_3', v)} />
          <Field label="External Documents"><input type="text" value={tree.external_documents || ''} onChange={e => set('external_documents', e.target.value)} className={inputClass} /></Field>
          <Field label="Blog Link"><input type="text" value={tree.blog_link || ''} onChange={e => set('blog_link', e.target.value)} className={inputClass} /></Field>
          <Field label="Notes (extended)"><textarea value={tree.notes_collection || ''} onChange={e => set('notes_collection', e.target.value)} rows={3} className={inputClass} /></Field>
        </Section>

        <Section title="Growing Medium">
          <Field label="Pot Size"><input type="text" value={tree.pot_size || ''} onChange={e => set('pot_size', e.target.value)} className={inputClass} /></Field>
          <Field label="Pot Type"><input type="text" value={tree.pot_type || ''} onChange={e => set('pot_type', e.target.value)} className={inputClass} /></Field>
          <Field label="Best Soil Mix"><input type="text" value={tree.best_soil_mix || ''} onChange={e => set('best_soil_mix', e.target.value)} className={inputClass} /></Field>
          <Field label="Soil Mix Used"><input type="text" value={tree.soil_mix_used || ''} onChange={e => set('soil_mix_used', e.target.value)} className={inputClass} /></Field>
        </Section>

        <Section title="Care Schedule">
          <Field label="Last Watered"><input type="date" value={tree.last_watered || ''} onChange={e => set('last_watered', e.target.value)} className={inputClass} /></Field>
          <div />
          <Field label="Last Fertilised"><input type="date" value={tree.last_fertilised || ''} onChange={e => set('last_fertilised', e.target.value)} className={inputClass} /></Field>
          <Field label="Next Fertilise Due">
            <input type="date" value={tree.next_fertilise_due || ''} onChange={e => set('next_fertilise_due', e.target.value)}
              className={inputClass + (isOverdue(tree.next_fertilise_due) ? ' border-red-500 bg-red-50' : '')} />
          </Field>
          <Field label="Last Repotted"><input type="date" value={tree.last_repotted || ''} onChange={e => set('last_repotted', e.target.value)} className={inputClass} /></Field>
          <Field label="Next Repot Due">
            <input type="date" value={tree.next_repot_due || ''} onChange={e => set('next_repot_due', e.target.value)}
              className={inputClass + (isOverdue(tree.next_repot_due) ? ' border-red-500 bg-red-50' : '')} />
          </Field>
          <Field label="Last Pruned"><input type="date" value={tree.last_pruned || ''} onChange={e => set('last_pruned', e.target.value)} className={inputClass} /></Field>
          <Field label="Due Prune Date">
            <input type="date" value={tree.due_prune_date || ''} onChange={e => set('due_prune_date', e.target.value)}
              className={inputClass + (isOverdue(tree.due_prune_date) ? ' border-red-500 bg-red-50' : '')} />
          </Field>
          <Field label="Date Wired"><input type="date" value={tree.date_wired || ''} onChange={e => set('date_wired', e.target.value)} className={inputClass} /></Field>
          <Field label="Date Check Wire">
            <input type="date" value={tree.date_check_wire || ''} onChange={e => set('date_check_wire', e.target.value)}
              className={inputClass + (isOverdue(tree.date_check_wire) ? ' border-red-500 bg-red-50' : '')} />
          </Field>
        </Section>

        <Section title="Physical Details">
          <Field label="Height (mm)"><input type="number" value={tree.height_mm || ''} onChange={e => set('height_mm', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
          <Field label="Trunk Thickness (mm)"><input type="number" value={tree.trunk_thickness_mm || ''} onChange={e => set('trunk_thickness_mm', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
          <Field label="Canopy Width (mm)"><input type="number" value={tree.canopy_width_mm || ''} onChange={e => set('canopy_width_mm', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
          <Field label="Weight (kg)"><input type="number" value={tree.weight_kg || ''} onChange={e => set('weight_kg', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
        </Section>

        <button
          type="button"
          onClick={handleDelete}
          className="text-red-500 text-sm mt-2"
        >
          Delete this tree
        </button>
      </div>

      {/* Save button - normal flow, not fixed */}
      <div className="mt-6 mb-10">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold w-full text-lg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>
    </main>
  )
}
