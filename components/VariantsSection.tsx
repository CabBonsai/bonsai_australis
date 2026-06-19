'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

function VariantField({ label, value, onChange, type = 'text' }: {
  label: string, value: any, onChange: (v: string) => void, type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1 text-gray-600">{label}</label>
      {type === 'textarea'
        ? <textarea value={value || ''} onChange={e => onChange(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" rows={2} />
        : <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
      }
    </div>
  )
}

function VariantCard({ variant, scoring, overrides, onDelete, onSaved }: {
  variant: any
  scoring: any
  overrides: any
  onDelete: (spNo: number) => void
  onSaved: () => void
}) {
  const [v, setV] = useState(variant)
  const [s, setS] = useState(scoring || { sp_no: variant.sp_no })
  const [o, setO] = useState(overrides || { sp_no: variant.sp_no })
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function updateV(field: string, value: any) { setV({ ...v, [field]: value }) }
  function updateS(field: string, value: any) { setS({ ...s, [field]: value }) }
  function updateO(field: string, value: any) { setO({ ...o, [field]: value }) }

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    const vResult = await supabase.from('variants').update({
      variant_name: v.variant_name,
      common_name: v.common_name,
      rating: v.rating,
      variant_type: v.variant_type,
      botanical_rank: v.botanical_rank,
      is_hybrid: v.is_hybrid,
      hybrid_parent_1: v.hybrid_parent_1,
      hybrid_parent_2: v.hybrid_parent_2,
      notes: v.notes,
      species_origin: v.species_origin,
      natural_habitat: v.natural_habitat,
      species_notes: v.species_notes,
    }).eq('sp_no', v.sp_no)

    const sResult = await supabase.from('bonsai_scoring').upsert({
      sp_no: v.sp_no,
      variant_name: v.variant_name,
      cultivar: s.cultivar,
      species_ref: s.species_ref,
      base_score: s.base_score,
      delta_vigor: s.delta_vigor,
      delta_back_budding: s.delta_back_budding,
      delta_ramification: s.delta_ramification,
      delta_leaf: s.delta_leaf,
      delta_root: s.delta_root,
      refine: s.refine,
      final_score: s.final_score,
      class: s.class,
    }, { onConflict: 'sp_no' })

    const oResult = await supabase.from('variant_overrides').upsert({
      sp_no: v.sp_no,
      variant_name: v.variant_name,
      override_repotting_cycles: o.override_repotting_cycles,
      override_soil_preferences: o.override_soil_preferences,
      override_fertilisation_patterns: o.override_fertilisation_patterns,
      override_watering_times: o.override_watering_times,
      override_watering_notes: o.override_watering_notes,
      override_winter_protection: o.override_winter_protection,
      override_important_species_info: o.override_important_species_info,
      override_detailed_general_overview: o.override_detailed_general_overview,
    }, { onConflict: 'sp_no' })

    const errors = [vResult.error, sResult.error, oResult.error].filter(Boolean)
    if (errors.length > 0) {
      setMessage('Error: ' + errors.map(e => e?.message).join(', '))
    } else {
      setMessage('Saved!')
      onSaved()
      setTimeout(() => setMessage(null), 2000)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete variant "${v.variant_name}"? This cannot be undone.`)) return
    await supabase.from('variant_overrides').delete().eq('sp_no', v.sp_no)
    await supabase.from('bonsai_scoring').delete().eq('sp_no', v.sp_no)
    await supabase.from('variants').delete().eq('sp_no', v.sp_no)
    onDelete(v.sp_no)
  }

  return (
    <div className="border rounded-lg p-3 mb-2 bg-gray-50">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-gray-400">sp_no: {v.sp_no}</span>
        <button onClick={handleDelete} className="text-red-500 text-xs">Delete</button>
      </div>

      <div className="space-y-2">
        <VariantField label="Variant name" value={v.variant_name} onChange={val => updateV('variant_name', val)} />
        <div className="flex gap-2">
          <div className="flex-1"><VariantField label="Rating" value={v.rating} onChange={val => updateV('rating', val)} /></div>
          <div className="flex-1"><VariantField label="Type" value={v.variant_type} onChange={val => updateV('variant_type', val)} /></div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-blue-600 text-xs mt-2"
      >
        {expanded ? 'Hide details ▲' : 'Show more details ▼'}
      </button>

      {expanded && (
        <div className="space-y-2 mt-2 pt-2 border-t">
          <VariantField label="Common name" value={v.common_name} onChange={val => updateV('common_name', val)} />
          <VariantField label="Botanical rank" value={v.botanical_rank} onChange={val => updateV('botanical_rank', val)} />
          <div className="flex gap-2">
            <div className="flex-1"><VariantField label="Hybrid parent 1" value={v.hybrid_parent_1} onChange={val => updateV('hybrid_parent_1', val)} /></div>
            <div className="flex-1"><VariantField label="Hybrid parent 2" value={v.hybrid_parent_2} onChange={val => updateV('hybrid_parent_2', val)} /></div>
          </div>
          <VariantField label="Notes" value={v.notes} onChange={val => updateV('notes', val)} type="textarea" />
          <VariantField label="Species origin" value={v.species_origin} onChange={val => updateV('species_origin', val)} type="textarea" />
          <VariantField label="Natural habitat" value={v.natural_habitat} onChange={val => updateV('natural_habitat', val)} type="textarea" />
          <VariantField label="Species notes" value={v.species_notes} onChange={val => updateV('species_notes', val)} type="textarea" />

          <p className="text-xs font-semibold text-gray-500 mt-3">Scoring</p>
          <VariantField label="Cultivar" value={s.cultivar} onChange={val => updateS('cultivar', val)} />
          <VariantField label="Species ref" value={s.species_ref} onChange={val => updateS('species_ref', val)} />
          <div className="flex gap-2">
            <div className="flex-1"><VariantField label="Base score" value={s.base_score} onChange={val => updateS('base_score', val)} /></div>
            <div className="flex-1"><VariantField label="Final score" value={s.final_score} onChange={val => updateS('final_score', val)} /></div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1"><VariantField label="\u0394 Vigor" value={s.delta_vigor} onChange={val => updateS('delta_vigor', val)} /></div>
            <div className="flex-1"><VariantField label="\u0394 Back budding" value={s.delta_back_budding} onChange={val => updateS('delta_back_budding', val)} /></div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1"><VariantField label="\u0394 Ramification" value={s.delta_ramification} onChange={val => updateS('delta_ramification', val)} /></div>
            <div className="flex-1"><VariantField label="\u0394 Leaf" value={s.delta_leaf} onChange={val => updateS('delta_leaf', val)} /></div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1"><VariantField label="\u0394 Root" value={s.delta_root} onChange={val => updateS('delta_root', val)} /></div>
            <div className="flex-1"><VariantField label="Refine" value={s.refine} onChange={val => updateS('refine', val)} /></div>
          </div>
          <VariantField label="Class" value={s.class} onChange={val => updateS('class', val)} />

          <p className="text-xs font-semibold text-gray-500 mt-3">Overrides</p>
          <VariantField label="Repotting cycles" value={o.override_repotting_cycles} onChange={val => updateO('override_repotting_cycles', val)} />
          <VariantField label="Soil preferences" value={o.override_soil_preferences} onChange={val => updateO('override_soil_preferences', val)} type="textarea" />
          <VariantField label="Fertilisation patterns" value={o.override_fertilisation_patterns} onChange={val => updateO('override_fertilisation_patterns', val)} type="textarea" />
          <VariantField label="Watering times" value={o.override_watering_times} onChange={val => updateO('override_watering_times', val)} />
          <VariantField label="Watering notes" value={o.override_watering_notes} onChange={val => updateO('override_watering_notes', val)} type="textarea" />
          <VariantField label="Winter protection" value={o.override_winter_protection} onChange={val => updateO('override_winter_protection', val)} />
          <VariantField label="Important species info" value={o.override_important_species_info} onChange={val => updateO('override_important_species_info', val)} type="textarea" />
          <VariantField label="Detailed overview" value={o.override_detailed_general_overview} onChange={val => updateO('override_detailed_general_overview', val)} type="textarea" />
        </div>
      )}

      <div className="flex justify-between items-center mt-3">
        {message && <span className="text-xs">{message}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto bg-blue-600 text-white px-3 py-1.5 rounded text-xs disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Variant'}
        </button>
      </div>
    </div>
  )
}

export default function VariantsSection({ spNo }: { spNo: string | number }) {
  const [variants, setVariants] = useState<any[]>([])
  const [scoringMap, setScoringMap] = useState<Record<string, any>>({})
  const [overridesMap, setOverridesMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function fetchVariants() {
    setLoading(true)
     const { data: variantRows } = await supabase
      .from('variants')
      .select('*')
      .eq('parent_sp_no', spNo)

    const rows = variantRows || []
    setVariants(rows)

    if (rows.length > 0) {
      const spNos = rows.map(r => r.sp_no)
      const { data: scoringRows } = await supabase.from('bonsai_scoring').select('*').in('sp_no', spNos)
      const { data: overrideRows } = await supabase.from('variant_overrides').select('*').in('sp_no', spNos)

      const sMap: Record<string, any> = {}
      ;(scoringRows || []).forEach(r => { sMap[r.sp_no] = r })
      setScoringMap(sMap)

      const oMap: Record<string, any> = {}
      ;(overrideRows || []).forEach(r => { oMap[r.sp_no] = r })
      setOverridesMap(oMap)
    }
    setLoading(false)
    setLoaded(true)
  }

  async function handleAddVariant() {
    const { data: maxRow } = await supabase
      .from('variants')
      .select('sp_no')
      .order('sp_no', { ascending: false })
      .limit(1)
      .single()

    const newSpNo = (maxRow?.sp_no || 0) + 1

    const { error } = await supabase.from('variants').insert({
      sp_no: newSpNo,
      parent_sp_no: Number(spNo),
      variant_name: 'New variant',
      no_parent: false,
    })

    if (!error) {
      fetchVariants()
    } else {
      alert('Error adding variant: ' + error.message)
    }
  }

  function handleDelete(deletedSpNo: number) {
    setVariants(variants.filter(v => v.sp_no !== deletedSpNo))
  }

  if (!loaded && !loading) {
    return (
      <button onClick={fetchVariants} className="text-blue-600 text-sm underline">
        Load variants
      </button>
    )
  }

  return (
    <div>
      {loading && <p className="text-sm text-gray-400">Loading variants...</p>}
      {!loading && (
        <>
          {variants.length === 0 && <p className="text-sm text-gray-400 mb-2">No variants yet.</p>}
          {variants.map(v => (
            <VariantCard
              key={v.sp_no}
              variant={v}
              scoring={scoringMap[v.sp_no]}
              overrides={overridesMap[v.sp_no]}
              onDelete={handleDelete}
              onSaved={fetchVariants}
            />
          ))}
          <button
            onClick={handleAddVariant}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-500 mt-2"
          >
            + Add Variant
          </button>
        </>
      )}
    </div>
  )
}