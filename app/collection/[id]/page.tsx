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

const inputClass = "w-full border rounded px-3 py-2 text-base"

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
        .limit(10)
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
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0"
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
        .limit(10)
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
        <ul className="absolute z-10 bg-white border rounded mt-1 w-full max-h-48 overflow-y-auto shadow-lg">
          {results.map((r, i) => (
            <li
              key={i}
              onClick={() => { onChange(r.variant_name); setQuery(r.variant_name); setOpen(false); setResults([]) }}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0"
            >
              {r.variant_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CollectionDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [tree, setTree] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  if (loading) {
    return <main className="max-w-2xl mx-auto px-4 py-8"><p className="text-gray-400">Loading...</p></main>
  }

  if (!tree) {
    return <main className="max-w-2xl mx-auto px-4 py-8"><p className="text-red-500">Tree not found.</p></main>
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 pb-28">
      <a href="/collection" className="text-sm text-blue-600 block mb-4">&larr; Back to Collection</a>

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
            <SpeciesAutocomplete value={tree.sp_no} onChange={(spNo) => set('sp_no', spNo)} />
          </Field>
          <Field label="Variation / Cultivar">
            <VariantAutocomplete spNo={tree.sp_no} value={tree.variation_or_cultivar || ''} onChange={val => set('variation_or_cultivar', val)} />
          </Field>
          <Field label="Style"><input type="text" value={tree.style || ''} onChange={e => set('style', e.target.value)} className={inputClass} /></Field>
          <Field label="Development Stage"><input type="text" value={tree.development_stage || ''} onChange={e => set('development_stage', e.target.value)} className={inputClass} /></Field>
          <Field label="Training Stage"><input type="text" value={tree.training_stage || ''} onChange={e => set('training_stage', e.target.value)} className={inputClass} /></Field>
          <Field label="Origin Material"><input type="text" value={tree.origin_material || ''} onChange={e => set('origin_material', e.target.value)} className={inputClass} /></Field>
          <Field label="Year Est. Planted"><input type="text" value={tree.year_est_planted || ''} onChange={e => set('year_est_planted', e.target.value)} className={inputClass} /></Field>
          <Field label="Estimated Age"><input type="text" value={tree.estimated_age || ''} onChange={e => set('estimated_age', e.target.value)} className={inputClass} /></Field>
          <Field label="Plan"><textarea value={tree.plan || ''} onChange={e => set('plan', e.target.value)} rows={2} className={inputClass} /></Field>
          <Field label="Intended Look"><textarea value={tree.intended_look || ''} onChange={e => set('intended_look', e.target.value)} rows={2} className={inputClass} /></Field>
          <Field label="Work Plan"><textarea value={tree.work_plan || ''} onChange={e => set('work_plan', e.target.value)} rows={2} className={inputClass} /></Field>
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

        <Section title="Growing Medium">
          <Field label="Pot Size"><input type="text" value={tree.pot_size || ''} onChange={e => set('pot_size', e.target.value)} className={inputClass} /></Field>
          <Field label="Pot Type"><input type="text" value={tree.pot_type || ''} onChange={e => set('pot_type', e.target.value)} className={inputClass} /></Field>
          <Field label="Best Soil Mix"><input type="text" value={tree.best_soil_mix || ''} onChange={e => set('best_soil_mix', e.target.value)} className={inputClass} /></Field>
          <Field label="Soil Mix Used"><input type="text" value={tree.soil_mix_used || ''} onChange={e => set('soil_mix_used', e.target.value)} className={inputClass} /></Field>
        </Section>

        <Section title="Physical Details">
          <Field label="Height (mm)"><input type="number" value={tree.height_mm || ''} onChange={e => set('height_mm', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
          <Field label="Trunk Thickness (mm)"><input type="number" value={tree.trunk_thickness_mm || ''} onChange={e => set('trunk_thickness_mm', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
          <Field label="Canopy Width (mm)"><input type="number" value={tree.canopy_width_mm || ''} onChange={e => set('canopy_width_mm', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
          <Field label="Weight (kg)"><input type="number" value={tree.weight_kg || ''} onChange={e => set('weight_kg', e.target.value ? parseFloat(e.target.value) : null)} className={inputClass} /></Field>
        </Section>

        <Section title="Location & Display">
          <Field label="Location"><input type="text" value={tree.location || ''} onChange={e => set('location', e.target.value)} className={inputClass} /></Field>
          <Field label="Bench Position"><input type="text" value={tree.bench_position || ''} onChange={e => set('bench_position', e.target.value)} className={inputClass} /></Field>
          <Field label="Display Status"><input type="text" value={tree.display_status || ''} onChange={e => set('display_status', e.target.value)} className={inputClass} /></Field>
        </Section>

        <Section title="Commercial">
          <Field label="Source"><input type="text" value={tree.source || ''} onChange={e => set('source', e.target.value)} className={inputClass} /></Field>
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

        <Section title="Media & Notes">
          <Field label="Image URL (primary)"><input type="text" value={tree.image_url || ''} onChange={e => set('image_url', e.target.value)} className={inputClass} /></Field>
          <Field label="Photo 1"><input type="text" value={tree.photo_1 || ''} onChange={e => set('photo_1', e.target.value)} className={inputClass} /></Field>
          <Field label="Photo 2"><input type="text" value={tree.photo_2 || ''} onChange={e => set('photo_2', e.target.value)} className={inputClass} /></Field>
          <Field label="Photo 3"><input type="text" value={tree.photo_3 || ''} onChange={e => set('photo_3', e.target.value)} className={inputClass} /></Field>
          <Field label="External Documents"><input type="text" value={tree.external_documents || ''} onChange={e => set('external_documents', e.target.value)} className={inputClass} /></Field>
          <Field label="Blog Link"><input type="text" value={tree.blog_link || ''} onChange={e => set('blog_link', e.target.value)} className={inputClass} /></Field>
          <Field label="Notes (extended)"><textarea value={tree.notes_collection || ''} onChange={e => set('notes_collection', e.target.value)} rows={3} className={inputClass} /></Field>
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