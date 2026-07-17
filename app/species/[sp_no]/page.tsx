'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import VariantsSection from '@/components/VariantsSection'

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      border: '1px solid #ded4bd',
      borderRadius: '14px',
      marginBottom: '14px',
      background: '#fffdf9',
      overflow: 'hidden',
      boxShadow: open ? '0 2px 10px rgba(63,82,40,0.06)' : 'none',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '16px 20px',
          fontWeight: 600,
          fontSize: '15px',
          letterSpacing: '0.02em',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: open ? '#f3efe2' : 'transparent',
          color: '#3f5228',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {title}
        <span style={{ color: '#8a9a6d', fontSize: '12px' }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </button>
      {open && <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>{children}</div>}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string, value: any, onChange: (v: string) => void, type?: string
}) {
  const [focused, setFocused] = useState(false)
  const baseBorder = focused ? '1.5px solid #7a9c42' : '1.5px solid #e2dac2'
  const boxShadow = focused ? '0 0 0 3px rgba(122,156,66,0.15)' : 'none'
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: '#8a7f5f',
        marginBottom: '6px',
      }}>{label}</label>
      {type === 'textarea'
        ? <textarea
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              width: '100%',
              minHeight: '190px',
              border: baseBorder,
              boxShadow,
              borderRadius: '10px',
              padding: '14px 16px',
              fontSize: '15px',
              lineHeight: 1.65,
              fontFamily: 'inherit',
              color: '#2b2620',
              background: '#fffefb',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            rows={8}
          />
        : <input
            type="text"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              width: '100%',
              border: baseBorder,
              boxShadow,
              borderRadius: '10px',
              padding: '11px 16px',
              fontSize: '15px',
              color: '#2b2620',
              background: '#fffefb',
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
      }
    </div>
  )
}

function SpeciesPhotoField({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('species-photos').upload(path, file)
      if (error) { alert('Upload failed: ' + error.message); return }
      const { data } = supabase.storage.from('species-photos').getPublicUrl(path)
      onChange(data.publicUrl)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">Reference Photo</label>
      {value && <img src={value} alt="Reference" style={{width:'100%',maxHeight:'300px',objectFit:'cover',borderRadius:'8px',marginBottom:'8px',border:'1px solid #e2e8f0'}} />}
      <div className="flex gap-2">
        <label htmlFor="species-ref-photo" className="flex-1 text-center bg-gray-100 border rounded px-3 py-2 text-sm cursor-pointer">
          {uploading ? 'Uploading...' : value ? '📷 Replace Photo' : '📷 Add Reference Photo'}
        </label>
        <input id="species-ref-photo" type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
        {value && <button type="button" onClick={() => onChange('')} className="text-red-500 text-sm px-2">✕</button>}
      </div>
    </div>
  )
}

// jsPDF's built-in 'helvetica' font only supports WinAnsiEncoding (~Windows-1252,
// which covers standard ASCII plus common extras like °, ×, em/en-dash, curly
// quotes, and bullet). Characters outside that table - Greek letters (Δ),
// arrows (→), and similar - have no glyph mapping and render as garbage, or
// throw off splitTextToSize's width calculation for the rest of the line.
// Convert known problem characters to a plain-text equivalent, and strip
// anything else outside the WinAnsi-safe range as a last resort.
function sanitizeForPDF(s: string): string {
  return s
    .replace(/Δ/g, 'Delta ')
    .replace(/[ΩαβγθλμπσφωΣ]/g, '')        // strip other stray Greek letters if present
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/⇒/g, '=>')
    .replace(/[\u2010\u2011\u2012\u2015]/g, '-')  // non-breaking/figure/horizontal-bar hyphens -> plain hyphen
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u2018\u2019\u201C\u201D\u2013\u2014\u2022]/g, '') // keep ASCII + WinAnsi/Latin-1 range (covers °, ×, etc.) + common typographic extras
}

function formatVal(v: any): string {
  if (v === null || v === undefined || v === '') return '— not set —'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return sanitizeForPDF(String(v))
}

export default function SpeciesDetail() {
  const params = useParams()
  const spNo = params.sp_no

  const [prevNext, setPrevNext] = useState<{prev: number|null, next: number|null}>({prev: null, next: null})
  const [species, setSpecies] = useState<any>(null)
  const [suitability, setSuitability] = useState<any>(null)
  const [careGuide, setCareGuide] = useState<any>(null)
  const [fertilisation, setFertilisation] = useState<any>(null)
  const [pruning, setPruning] = useState<any>(null)
  const [nebari, setNebari] = useState<any>(null)
  const [seasonal, setSeasonal] = useState<any>(null)
  const [advanced, setAdvanced] = useState<any>(null)
  const [regional, setRegional] = useState<any>(null)
  const [placement, setPlacement] = useState<any>(null)
  const [toxicity, setToxicity] = useState<any>(null)
  const [tubestockDev, setTubestockDev] = useState<any>(null)
  const [tubestockRows, setTubestockRows] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [generatingReport, setGeneratingReport] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAll() {
      const [speciesRes, suitRes, careRes, fertRes, pruneRes, nebRes, seasRes, advRes, regRes, placeRes, toxRes, devRes, tubeRes, prevRes, nextRes] = await Promise.all([
        supabase.from('species').select('*').eq('sp_no', spNo).single(),
        supabase.from('bonsai_suitability').select('*').eq('sp_no', spNo).single(),
        supabase.from('care_guide').select('*').eq('sp_no', spNo).single(),
        supabase.from('fertilisation').select('*').eq('sp_no', spNo).single(),
        supabase.from('pruning_protocols').select('*').eq('sp_no', spNo).single(),
        supabase.from('nebari_root').select('*').eq('sp_no', spNo).single(),
        supabase.from('seasonal_maintenance').select('*').eq('sp_no', spNo).single(),
        supabase.from('advanced_expert').select('*').eq('sp_no', spNo).single(),
        supabase.from('regional_suitability').select('*').eq('sp_no', spNo).single(),
        supabase.from('placement_matrix').select('*').eq('sp_no', spNo).single(),
        supabase.from('toxicity').select('*').eq('sp_no', spNo).single(),
        supabase.from('tubestock_development').select('*').eq('sp_no', spNo).single(),
        supabase.from('tubestock').select('*').eq('sp_no', spNo).order('created_at', { ascending: false }),
        supabase.from('species').select('sp_no').lt('sp_no', spNo).order('sp_no', { ascending: false }).limit(1).single(),
        supabase.from('species').select('sp_no').gt('sp_no', spNo).order('sp_no', { ascending: true }).limit(1).single(),
      ])
      if (speciesRes.error) setError(speciesRes.error.message)
      else setSpecies(speciesRes.data)
      if (!suitRes.error) setSuitability(suitRes.data)
      if (!careRes.error) setCareGuide(careRes.data)
      if (!fertRes.error) setFertilisation(fertRes.data)
      if (!pruneRes.error) setPruning(pruneRes.data)
      if (!nebRes.error) setNebari(nebRes.data)
      if (!seasRes.error) setSeasonal(seasRes.data)
      if (!advRes.error) setAdvanced(advRes.data)
      if (!regRes.error) setRegional(regRes.data)
      if (!placeRes.error) setPlacement(placeRes.data)
      if (!toxRes.error) setToxicity(toxRes.data)
      if (!devRes.error) setTubestockDev(devRes.data)
      if (!tubeRes.error) setTubestockRows(tubeRes.data || [])
      setPrevNext({ prev: prevRes.data?.sp_no ?? null, next: nextRes.data?.sp_no ?? null })
      setLoading(false)
    }
    fetchAll()
  }, [spNo])

  function updateSpecies(field: string, value: any) { setSpecies({ ...species, [field]: value }) }
  function updateSuitability(field: string, value: any) { setSuitability({ ...suitability, [field]: value }) }
  function updateCareGuide(field: string, value: any) { setCareGuide({ ...careGuide, [field]: value }) }
  function updateFertilisation(field: string, value: any) { setFertilisation({ ...fertilisation, [field]: value }) }
  function updatePruning(field: string, value: any) { setPruning({ ...pruning, [field]: value }) }
  function updateNebari(field: string, value: any) { setNebari({ ...nebari, [field]: value }) }
  function updateSeasonal(field: string, value: any) { setSeasonal({ ...seasonal, [field]: value }) }
  function updateAdvanced(field: string, value: any) { setAdvanced({ ...advanced, [field]: value }) }
  function updateRegional(field: string, value: any) { setRegional({ ...regional, [field]: value }) }
  function updatePlacement(field: string, value: any) { setPlacement({ ...placement, [field]: value }) }
  function updateToxicity(field: string, value: any) { setToxicity({ ...toxicity, [field]: value }) }
  function updateTubestockDev(field: string, value: any) { setTubestockDev({ ...tubestockDev, [field]: value }) }

  async function handleSave() {
    setSaving(true)
    setSaveMessage(null)
    const saves: any[] = [
      supabase.from('species').update({
        species: species.species,
        common_name: species.common_name,
        species_genus: species.species_genus,
        species_epithet: species.species_epithet,
        species_family: species.species_family,
        tree_type: species.tree_type,
        pure_species: species.pure_species,
        australian_native: species.australian_native,
        species_origin: species.species_origin,
        natural_habitat: species.natural_habitat,
        species_notes: species.species_notes,
        research_notes: species.research_notes,
        research_status: species.research_status,
        reference_photo: species.reference_photo,
        review_status: species.review_status,
        review_notes: species.review_notes,
      }).eq('sp_no', spNo),
    ]
    if (suitability) saves.push(supabase.from('bonsai_suitability').update({
      bonsai_suitability: suitability.bonsai_suitability,
      difficulty: suitability.difficulty,
      recommended_bonsai_styles: suitability.recommended_bonsai_styles,
      vigor: suitability.vigor,
      vigor_notes: suitability.vigor_notes,
      back_budding_ability: suitability.back_budding_ability,
      back_budding_notes: suitability.back_budding_notes,
      ramification_potential: suitability.ramification_potential,
      ramification_notes: suitability.ramification_notes,
      leaf_reduction_potential: suitability.leaf_reduction_potential,
      leaf_reduction_notes: suitability.leaf_reduction_notes,
      root_tolerance_score: suitability.root_tolerance_score,
      root_tolerance_notes: suitability.root_tolerance_notes,
      final_bonsai_score: suitability.final_bonsai_score,
      bonsai_tier: suitability.bonsai_tier,
    }).eq('sp_no', spNo))
    if (careGuide) saves.push(supabase.from('care_guide').update({
      growth_season: careGuide.growth_season,
      growth_season_notes: careGuide.growth_season_notes,
      growth_plan: careGuide.growth_plan,
      watering: careGuide.watering,
      watering_frequency: careGuide.watering_frequency,
      sun_exposure: careGuide.sun_exposure,
      light_requirements: careGuide.light_requirements,
      fertilizing: careGuide.fertilizing,
      best_fertiliser_australia: careGuide.best_fertiliser_australia,
      promote_growth: careGuide.promote_growth,
      promote_back_budding: careGuide.promote_back_budding,
      style_options: careGuide.style_options,
      styling_considerations: careGuide.styling_considerations,
      technical_training_styling: careGuide.technical_training_styling,
      pruning_refinement_protocols: careGuide.pruning_refinement_protocols,
      wiring: careGuide.wiring,
      branch_direction_after_wiring: careGuide.branch_direction_after_wiring,
      repotting_guide: careGuide.repotting_guide,
      best_soil_mix: careGuide.best_soil_mix,
      pests_and_diseases: careGuide.pests_and_diseases,
      climate_zone: careGuide.climate_zone,
      watering_summer_notes: careGuide.watering_summer_notes,
      watering_winter_notes: careGuide.watering_winter_notes,
      summer_sun_protection: careGuide.summer_sun_protection,
      frost_risk: careGuide.frost_risk,
      min_temp_c: careGuide.min_temp_c,
      pruning_season: careGuide.pruning_season,
      repotting_season: careGuide.repotting_season,
      repotting_freq_yrs: careGuide.repotting_freq_yrs,
    }).eq('sp_no', spNo))
    if (fertilisation) saves.push(supabase.from('fertilisation').update({
      p_tolerance: fertilisation.p_tolerance,
      n_requirement: fertilisation.n_requirement,
      preferred_fertiliser_types: fertilisation.preferred_fertiliser_types,
      avoid_fertilisers: fertilisation.avoid_fertilisers,
      recommended_products: fertilisation.recommended_products,
      notes_schema: fertilisation.notes_schema,
    }).eq('sp_no', spNo))
    if (pruning) saves.push(supabase.from('pruning_protocols').update({
      pruning_core_rules: pruning.pruning_core_rules,
      structural_pruning_timing: pruning.structural_pruning_timing,
      structural_pruning_method: pruning.structural_pruning_method,
      structural_pruning_limits: pruning.structural_pruning_limits,
      post_flowering_pruning_timing: pruning.post_flowering_pruning_timing,
      post_flowering_pruning_method: pruning.post_flowering_pruning_method,
      maintenance_pruning_timing: pruning.maintenance_pruning_timing,
      maintenance_pruning_method: pruning.maintenance_pruning_method,
      old_wood_management: pruning.old_wood_management,
      seasonal_timing_seq: pruning.seasonal_timing_seq,
      recommended_techniques: pruning.recommended_techniques,
      common_mistakes: pruning.common_mistakes,
      apical_management_strategy: pruning.apical_management_strategy,
      branch_selection_rules: pruning.branch_selection_rules,
      light_penetration_strategy: pruning.light_penetration_strategy,
      refinement_method: pruning.refinement_method,
      notes: pruning.notes,
    }).eq('sp_no', spNo))
    if (nebari) saves.push(supabase.from('nebari_root').update({
      root_architecture_type: nebari.root_architecture_type,
      natural_nebari_form: nebari.natural_nebari_form,
      root_depth_tendency: nebari.root_depth_tendency,
      root_spread_behaviour: nebari.root_spread_behaviour,
      development_speed: nebari.development_speed,
      years_to_initial_nebari: nebari.years_to_initial_nebari,
      years_to_mature_nebari: nebari.years_to_mature_nebari,
      climate_influence_seq: nebari.climate_influence_seq,
      taproot_removal_tolerance: nebari.taproot_removal_tolerance,
      radial_root_pruning_response: nebari.radial_root_pruning_response,
      root_reduction_tolerance: nebari.root_reduction_tolerance,
      fine_root_production: nebari.fine_root_production,
      root_rot_susceptibility: nebari.root_rot_susceptibility,
      ground_layering_suitability: nebari.ground_layering_suitability,
      tourniquet_method_suitability: nebari.tourniquet_method_suitability,
      root_grafting_success_rate: nebari.root_grafting_success_rate,
      nebari_fusion_potential: nebari.nebari_fusion_potential,
      best_techniques_for_species: nebari.best_techniques_for_species,
      typical_nebari_faults: nebari.typical_nebari_faults,
      underlying_causes: nebari.underlying_causes,
      corrective_strategies: nebari.corrective_strategies,
      preferred_pot_depth: nebari.preferred_pot_depth,
      preferred_pot_width: nebari.preferred_pot_width,
      surface_substrate_preference: nebari.surface_substrate_preference,
      moisture_preference: nebari.moisture_preference,
      heat_sensitivity_at_root_base: nebari.heat_sensitivity_at_root_base,
      ultimate_nebari_quality_potential: nebari.ultimate_nebari_quality_potential,
      expected_mature_nebari_form: nebari.expected_mature_nebari_form,
      maintenance_requirements: nebari.maintenance_requirements,
      ageing_notes: nebari.ageing_notes,
      notes_for_future_development: nebari.notes_for_future_development,
    }).eq('sp_no', spNo))
    if (seasonal) saves.push(supabase.from('seasonal_maintenance').update({
      spring_maintenance_guide: seasonal.spring_maintenance_guide,
      summer_maintenance_guide: seasonal.summer_maintenance_guide,
      autumn_maintenance_guide: seasonal.autumn_maintenance_guide,
      winter_maintenance_guide: seasonal.winter_maintenance_guide,
      general_maintenance_notes: seasonal.general_maintenance_notes,
      spring_care: seasonal.spring_care,
      summer_care: seasonal.summer_care,
      autumn_care: seasonal.autumn_care,
      winter_care: seasonal.winter_care,
    }).eq('sp_no', spNo))
    if (advanced) saves.push(supabase.from('advanced_expert').update({
      ph_target: advanced.ph_target,
      acquisition_raw_material: advanced.acquisition_raw_material,
      aesthetics_exhibition_philosophy: advanced.aesthetics_exhibition_philosophy,
      advanced_structural_engineering: advanced.advanced_structural_engineering,
      morphology_notes: advanced.morphology_notes,
      cambial_notes: advanced.cambial_notes,
      seasonal_physiology: advanced.seasonal_physiology,
      energy_model: advanced.energy_model,
      backbudding_notes: advanced.backbudding_notes,
      ramification_stages: advanced.ramification_stages,
      root_notes: advanced.root_notes,
      hormonal_model: advanced.hormonal_model,
      needle_control: advanced.needle_control,
      climate_notes: advanced.climate_notes,
      repotting_season_notes: advanced.repotting_season_notes,
      styling_biomechanics: advanced.styling_biomechanics,
      development_years_1_3: advanced.development_years_1_3,
      development_years_4_6: advanced.development_years_4_6,
      development_years_7_8: advanced.development_years_7_8,
      development_years_9_10: advanced.development_years_9_10,
    }).eq('sp_no', spNo))
    if (regional) saves.push(supabase.from('regional_suitability').update({
      tropical_suitability: regional.tropical_suitability,
      tropical_notes: regional.tropical_notes,
      tropical_risk: regional.tropical_risk,
      tropical_training_adjustments: regional.tropical_training_adjustments,
      tropical_soil_modifier: regional.tropical_soil_modifier,
      tropical_watering_modifier: regional.tropical_watering_modifier,
      subtropical_suitability: regional.subtropical_suitability,
      subtropical_notes: regional.subtropical_notes,
      subtropical_risk: regional.subtropical_risk,
      subtropical_training_adjustments: regional.subtropical_training_adjustments,
      subtropical_soil_modifier: regional.subtropical_soil_modifier,
      subtropical_watering_modifier: regional.subtropical_watering_modifier,
      temperate_suitability: regional.temperate_suitability,
      temperate_notes: regional.temperate_notes,
      temperate_risk: regional.temperate_risk,
      temperate_training_adjustments: regional.temperate_training_adjustments,
      temperate_soil_modifier: regional.temperate_soil_modifier,
      temperate_watering_modifier: regional.temperate_watering_modifier,
      cold_suitability: regional.cold_suitability,
      cold_notes: regional.cold_notes,
      cold_risk: regional.cold_risk,
      cold_training_adjustments: regional.cold_training_adjustments,
      cold_soil_modifier: regional.cold_soil_modifier,
      cold_watering_modifier: regional.cold_watering_modifier,
      availability_australia: regional.availability_australia,
      availability_notes: regional.availability_notes,
      nursery_availability: regional.nursery_availability,
      wild_collection_status: regional.wild_collection_status,
    }).eq('sp_no', spNo))
    if (placement) saves.push(supabase.from('placement_matrix').update({
      species: placement.species,
      exposure_full_sun: placement.exposure_full_sun,
      exposure_morning_sun: placement.exposure_morning_sun,
      exposure_dappled_shade: placement.exposure_dappled_shade,
      exposure_full_shade: placement.exposure_full_shade,
      exposure_variable_e: placement.exposure_variable_e,
      exposure_variable_f: placement.exposure_variable_f,
      seq_notes: placement.seq_notes,
      national_notes: placement.national_notes,
    }).eq('sp_no', spNo))
    if (toxicity) saves.push(supabase.from('toxicity').update({
      species: toxicity.species,
      toxicity_level: toxicity.toxicity_level,
      toxic_to_humans: toxicity.toxic_to_humans,
      toxic_to_pets: toxicity.toxic_to_pets,
      toxic_to_livestock: toxicity.toxic_to_livestock,
      toxic_parts: toxicity.toxic_parts,
      toxic_principle: toxicity.toxic_principle,
      symptoms: toxicity.symptoms,
      severity_notes: toxicity.severity_notes,
      first_aid_notes: toxicity.first_aid_notes,
    }).eq('sp_no', spNo))
    if (tubestockDev) saves.push(supabase.from('tubestock_development').update({
      species: tubestockDev.species,
      establishment_period_weeks: tubestockDev.establishment_period_weeks,
      survival_rate_notes: tubestockDev.survival_rate_notes,
      common_failures: tubestockDev.common_failures,
      tubestock_potting_mix: tubestockDev.tubestock_potting_mix,
      first_pot_size: tubestockDev.first_pot_size,
      potting_on_schedule: tubestockDev.potting_on_schedule,
      initial_potting_timing: tubestockDev.initial_potting_timing,
      watering_frequency: tubestockDev.watering_frequency,
      fertilising_regime: tubestockDev.fertilising_regime,
      recommended_fertiliser: tubestockDev.recommended_fertiliser,
      growth_rate_expected: tubestockDev.growth_rate_expected,
      first_pruning_timing: tubestockDev.first_pruning_timing,
      first_structure_timing: tubestockDev.first_structure_timing,
      root_establishment_notes: tubestockDev.root_establishment_notes,
      nursery_to_training_pot: tubestockDev.nursery_to_training_pot,
      revegetation_planting_notes: tubestockDev.revegetation_planting_notes,
      establishment_in_ground: tubestockDev.establishment_in_ground,
      weed_competition_tolerance: tubestockDev.weed_competition_tolerance,
      irrigation_requirement: tubestockDev.irrigation_requirement,
      species_specific_notes: tubestockDev.species_specific_notes,
      record_complete: tubestockDev.record_complete,
      last_updated: tubestockDev.last_updated,
      research_status: tubestockDev.research_status,
      data_source: tubestockDev.data_source,
      research_notes: tubestockDev.research_notes,
      reference_urls: tubestockDev.reference_urls,
      needs_verification: tubestockDev.needs_verification,
    }).eq('sp_no', spNo))
    const results = await Promise.all(saves)
    const errors = results.filter((r: any) => r.error).map((r: any) => r.error.message)
    if (errors.length > 0) {
      setSaveMessage('Error: ' + errors.join(', '))
    } else {
      setSaveMessage('Saved!')
      setTimeout(() => setSaveMessage(null), 2000)
    }
    setSaving(false)
  }

  async function generatePDF(reportType: 'basic' | 'advanced') {
    setGeneratingReport(reportType)
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
      } catch (e) { console.warn('Logo failed to load', e) }

      const reportLabel = reportType === 'basic' ? 'Species Report' : 'Advanced Species Report'

      if (logoDataUrl) {
        const logoSize = 60
        doc.addImage(logoDataUrl, 'PNG', margin, y, logoSize, logoSize)
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text('Bonsai Australis', margin + logoSize + 15, y + 28)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text(reportLabel, margin + logoSize + 15, y + 46)
        y += logoSize + 25
      } else {
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text(`Bonsai Australis — ${reportLabel}`, margin, y + 10)
        y += 35
      }

      doc.setDrawColor(180)
      doc.line(margin, y, pageWidth - margin, y)
      y += 20

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(species.species || 'Unnamed Species', margin, y)
      y += 18

      if (species.common_name && species.common_name !== 'Unknown') {
        doc.setFontSize(11)
        doc.setFont('helvetica', 'italic')
        doc.text(species.common_name, margin, y)
        y += 16
      }

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`sp_no: ${spNo}`, margin, y)
      y += 18

      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120, 120, 120)
      const disclaimerLines = doc.splitTextToSize(
        '\u00A9 Bonsai Australis. This information is provided for discussion and research purposes only and does not constitute professional horticultural, arboricultural, or bonsai advice. Always verify against multiple sources before acting.',
        pageWidth - margin * 2
      )
      doc.text(disclaimerLines, margin, y)
      y += 12 * disclaimerLines.length + 10
      doc.setTextColor(0, 0, 0)

      function checkPageBreak(needed: number) {
        if (y + needed > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 40 }
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
          // Subtract an extra safety margin here: jsPDF calculates wrapping using its
          // own internal assumed widths for the built-in 'helvetica' font, but doesn't
          // embed that font in the file - actual rendering relies on whatever font each
          // PDF viewer substitutes for it. On long lines, small per-character width
          // differences between viewers can compound enough to push text past the edge
          // even though jsPDF's own math said it would fit. Wrapping noticeably earlier
          // leaves headroom so that drift doesn't reach the true page edge in practice.
          const lines = doc.splitTextToSize(formatted, pageWidth - margin * 2 - 170 - 30)
          checkPageBreak(14 * lines.length + 4)
          doc.setTextColor(60, 60, 60)
          doc.text(`${label}:`, margin + 5, y)
          doc.setTextColor(isEmpty ? 180 : 20, isEmpty ? 180 : 20, isEmpty ? 180 : 20)
          doc.text(lines, margin + 170, y)
          y += 14 * lines.length
        })
        doc.setTextColor(0, 0, 0)
        y += 8
      }

      if (reportType === 'basic') {
        addSection('Species Info', [
          ['Research Status', species.research_status],
          ['Genus', species.species_genus],
          ['Epithet', species.species_epithet],
          ['Family', species.species_family],
          ['Tree Type', species.tree_type],
          ['Pure Species', species.pure_species],
          ['AU Native', species.australian_native],
          ['Origin', species.species_origin],
          ['Natural Habitat', species.natural_habitat],
          ['Species Notes', species.species_notes],
          ['Quick Notes', species.research_notes],
        ])
        if (suitability) {
          addSection('Bonsai Suitability', [
            ['Suitability', suitability.bonsai_suitability],
            ['Difficulty', suitability.difficulty],
            ['Recommended Styles', suitability.recommended_bonsai_styles],
            ['Vigor', suitability.vigor],
            ['Vigor Notes', suitability.vigor_notes],
            ['Back Budding Ability', suitability.back_budding_ability],
            ['Back Budding Notes', suitability.back_budding_notes],
            ['Ramification Potential', suitability.ramification_potential],
            ['Ramification Notes', suitability.ramification_notes],
            ['Leaf Reduction Potential', suitability.leaf_reduction_potential],
            ['Leaf Reduction Notes', suitability.leaf_reduction_notes],
            ['Root Tolerance Score', suitability.root_tolerance_score],
            ['Root Tolerance Notes', suitability.root_tolerance_notes],
            ['Final Bonsai Score', suitability.final_bonsai_score],
            ['Tier', suitability.bonsai_tier],
          ])
          checkPageBreak(14)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'italic')
          doc.setTextColor(120, 120, 120)
          doc.text('Note: all suitability ratings are expressed on a scale of 1-100.', margin + 5, y)
          doc.setTextColor(0, 0, 0)
          y += 16
        }
        if (careGuide) addSection('Care Guide', [
          ['Growth Season', careGuide.growth_season],
          ['Growth Season Notes', careGuide.growth_season_notes],
          ['Growth Plan', careGuide.growth_plan],
          ['Watering', careGuide.watering],
          ['Watering Frequency', careGuide.watering_frequency],
          ['Sun Exposure', careGuide.sun_exposure],
          ['Light Requirements', careGuide.light_requirements],
          ['Fertilizing', careGuide.fertilizing],
          ['Best Fertiliser (AU)', careGuide.best_fertiliser_australia],
          ['Promote Growth', careGuide.promote_growth],
          ['Promote Back Budding', careGuide.promote_back_budding],
          ['Style Options', careGuide.style_options],
          ['Styling Considerations', careGuide.styling_considerations],
          ['Technical Training & Styling', careGuide.technical_training_styling],
          ['Pruning & Refinement', careGuide.pruning_refinement_protocols],
          ['Wiring', careGuide.wiring],
          ['Branch Direction After Wiring', careGuide.branch_direction_after_wiring],
          ['Repotting Guide', careGuide.repotting_guide],
          ['Best Soil Mix', careGuide.best_soil_mix],
          ['Pests & Diseases', careGuide.pests_and_diseases],
          ['Climate Zone', careGuide.climate_zone],
          ['Watering (Summer)', careGuide.watering_summer_notes],
          ['Watering (Winter)', careGuide.watering_winter_notes],
          ['Summer Sun Protection', careGuide.summer_sun_protection],
          ['Frost Risk', careGuide.frost_risk],
          ['Min Temp (C)', careGuide.min_temp_c],
          ['Pruning Season', careGuide.pruning_season],
          ['Repotting Season', careGuide.repotting_season],
          ['Repotting Frequency (yrs)', careGuide.repotting_freq_yrs],
        ])
        if (toxicity) addSection('Toxicity', [
          ['Toxicity Level', toxicity.toxicity_level],
          ['Toxic to Humans', toxicity.toxic_to_humans],
          ['Toxic to Pets', toxicity.toxic_to_pets],
          ['Toxic to Livestock', toxicity.toxic_to_livestock],
          ['Toxic Parts', toxicity.toxic_parts],
          ['Toxic Principle', toxicity.toxic_principle],
          ['Symptoms', toxicity.symptoms],
          ['Severity Notes', toxicity.severity_notes],
          ['First Aid Notes', toxicity.first_aid_notes],
        ])
      } else {
        if (fertilisation) addSection('Fertilisation', [
          ['P Tolerance', fertilisation.p_tolerance],
          ['N Requirement', fertilisation.n_requirement],
          ['Preferred Fertiliser Types', fertilisation.preferred_fertiliser_types],
          ['Avoid Fertilisers', fertilisation.avoid_fertilisers],
          ['Recommended Products', fertilisation.recommended_products],
          ['Notes', fertilisation.notes_schema],
        ])
        if (pruning) addSection('Pruning Protocols', [
          ['Core Rules', pruning.pruning_core_rules],
          ['Structural Pruning Timing', pruning.structural_pruning_timing],
          ['Structural Pruning Method', pruning.structural_pruning_method],
          ['Structural Pruning Limits', pruning.structural_pruning_limits],
          ['Post-Flowering Timing', pruning.post_flowering_pruning_timing],
          ['Post-Flowering Method', pruning.post_flowering_pruning_method],
          ['Maintenance Timing', pruning.maintenance_pruning_timing],
          ['Maintenance Method', pruning.maintenance_pruning_method],
          ['Old Wood Management', pruning.old_wood_management],
          ['Seasonal Timing', pruning.seasonal_timing_seq],
          ['Recommended Techniques', pruning.recommended_techniques],
          ['Common Mistakes', pruning.common_mistakes],
          ['Apical Management', pruning.apical_management_strategy],
          ['Branch Selection Rules', pruning.branch_selection_rules],
          ['Light Penetration Strategy', pruning.light_penetration_strategy],
          ['Refinement Method', pruning.refinement_method],
          ['Notes', pruning.notes],
        ])
        if (nebari) addSection('Nebari and Root', [
          ['Root Architecture Type', nebari.root_architecture_type],
          ['Natural Nebari Form', nebari.natural_nebari_form],
          ['Root Depth Tendency', nebari.root_depth_tendency],
          ['Root Spread Behaviour', nebari.root_spread_behaviour],
          ['Development Speed', nebari.development_speed],
          ['Years to Initial Nebari', nebari.years_to_initial_nebari],
          ['Years to Mature Nebari', nebari.years_to_mature_nebari],
          ['Climate Influence', nebari.climate_influence_seq],
          ['Taproot Removal Tolerance', nebari.taproot_removal_tolerance],
          ['Radial Root Pruning Response', nebari.radial_root_pruning_response],
          ['Root Reduction Tolerance', nebari.root_reduction_tolerance],
          ['Fine Root Production', nebari.fine_root_production],
          ['Root Rot Susceptibility', nebari.root_rot_susceptibility],
          ['Ground Layering Suitability', nebari.ground_layering_suitability],
          ['Tourniquet Method', nebari.tourniquet_method_suitability],
          ['Root Grafting Success Rate', nebari.root_grafting_success_rate],
          ['Nebari Fusion Potential', nebari.nebari_fusion_potential],
          ['Best Techniques', nebari.best_techniques_for_species],
          ['Typical Nebari Faults', nebari.typical_nebari_faults],
          ['Underlying Causes', nebari.underlying_causes],
          ['Corrective Strategies', nebari.corrective_strategies],
          ['Preferred Pot Depth', nebari.preferred_pot_depth],
          ['Preferred Pot Width', nebari.preferred_pot_width],
          ['Surface Substrate Preference', nebari.surface_substrate_preference],
          ['Moisture Preference', nebari.moisture_preference],
          ['Heat Sensitivity at Root Base', nebari.heat_sensitivity_at_root_base],
          ['Ultimate Nebari Quality', nebari.ultimate_nebari_quality_potential],
          ['Expected Mature Nebari Form', nebari.expected_mature_nebari_form],
          ['Maintenance Requirements', nebari.maintenance_requirements],
          ['Ageing Notes', nebari.ageing_notes],
          ['Notes for Future Development', nebari.notes_for_future_development],
        ])
        if (seasonal) addSection('Seasonal Maintenance', [
          ['Spring Guide', seasonal.spring_maintenance_guide],
          ['Summer Guide', seasonal.summer_maintenance_guide],
          ['Autumn Guide', seasonal.autumn_maintenance_guide],
          ['Winter Guide', seasonal.winter_maintenance_guide],
          ['General Notes', seasonal.general_maintenance_notes],
          ['Spring Care', seasonal.spring_care],
          ['Summer Care', seasonal.summer_care],
          ['Autumn Care', seasonal.autumn_care],
          ['Winter Care', seasonal.winter_care],
        ])
        if (advanced) addSection('Advanced and Expert', [
          ['pH Target', advanced.ph_target],
          ['Back Budding Notes', advanced.backbudding_notes],
          ['Ramification Stages', advanced.ramification_stages],
          ['Root Notes', advanced.root_notes],
          ['Hormonal Model', advanced.hormonal_model],
          ['Needle Control', advanced.needle_control],
          ['Climate Notes', advanced.climate_notes],
          ['Repotting Season Notes', advanced.repotting_season_notes],
          ['Styling Biomechanics', advanced.styling_biomechanics],
          ['Morphology Notes', advanced.morphology_notes],
          ['Cambial Notes', advanced.cambial_notes],
          ['Seasonal Physiology', advanced.seasonal_physiology],
          ['Energy Model', advanced.energy_model],
          ['Acquisition Raw Material', advanced.acquisition_raw_material],
          ['Aesthetics & Exhibition', advanced.aesthetics_exhibition_philosophy],
          ['Advanced Structural Engineering', advanced.advanced_structural_engineering],
          ['Development Years 1-3', advanced.development_years_1_3],
          ['Development Years 4-6', advanced.development_years_4_6],
          ['Development Years 7-8', advanced.development_years_7_8],
          ['Development Years 9-10', advanced.development_years_9_10],
        ])
        if (regional) addSection('Regional Suitability', [
          ['Tropical Suitability', regional.tropical_suitability],
          ['Tropical Notes', regional.tropical_notes],
          ['Tropical Risk', regional.tropical_risk],
          ['Tropical Training Adjustments', regional.tropical_training_adjustments],
          ['Tropical Soil Modifier', regional.tropical_soil_modifier],
          ['Tropical Watering Modifier', regional.tropical_watering_modifier],
          ['Subtropical Suitability', regional.subtropical_suitability],
          ['Subtropical Notes', regional.subtropical_notes],
          ['Subtropical Risk', regional.subtropical_risk],
          ['Subtropical Training Adjustments', regional.subtropical_training_adjustments],
          ['Subtropical Soil Modifier', regional.subtropical_soil_modifier],
          ['Subtropical Watering Modifier', regional.subtropical_watering_modifier],
          ['Temperate Suitability', regional.temperate_suitability],
          ['Temperate Notes', regional.temperate_notes],
          ['Temperate Risk', regional.temperate_risk],
          ['Temperate Training Adjustments', regional.temperate_training_adjustments],
          ['Temperate Soil Modifier', regional.temperate_soil_modifier],
          ['Temperate Watering Modifier', regional.temperate_watering_modifier],
          ['Cold Suitability', regional.cold_suitability],
          ['Cold Notes', regional.cold_notes],
          ['Cold Risk', regional.cold_risk],
          ['Cold Training Adjustments', regional.cold_training_adjustments],
          ['Cold Soil Modifier', regional.cold_soil_modifier],
          ['Cold Watering Modifier', regional.cold_watering_modifier],
          ['Availability (Australia)', regional.availability_australia],
          ['Availability Notes', regional.availability_notes],
          ['Nursery Availability', regional.nursery_availability],
          ['Wild Collection Status', regional.wild_collection_status],
        ])
        if (placement) {
          addSection('Placement Matrix', [
            ['Full Sun (A)', placement.exposure_full_sun],
            ['Morning Sun (B)', placement.exposure_morning_sun],
            ['Dappled Shade (C)', placement.exposure_dappled_shade],
            ['Full Sun, Windy (D)', placement.exposure_full_shade],
            ['Variable, Cold Drainage (E)', placement.exposure_variable_e],
            ['Variable, Sheltered (F)', placement.exposure_variable_f],
            ['SEQ Notes', placement.seq_notes],
            ['National Notes', placement.national_notes],
          ])
          checkPageBreak(80)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(100, 100, 100)
          doc.text('Zone reference (each rated Ideal / Tolerable / Unsuitable above):', margin, y)
          y += 12
          doc.setFont('helvetica', 'normal')
          const zoneDefs = [
            ['A', 'Full sun, 8-10hrs — hot westerlies, turbulent gusts'],
            ['B', 'Morning sun, 4-6hrs — gentle airflow, occasional gusts'],
            ['C', 'Dappled shade, 2-4hrs — soft airflow, sheltered'],
            ['D', 'Full sun, 6-8hrs — consistent strong airflow, wind tunnel'],
            ['E', 'Variable, 3-5hrs — cold air drainage, stagnant air (frost pocket)'],
            ['F', 'Variable, 2-6hrs — sheltered, minimal airflow'],
          ]
          zoneDefs.forEach(([letter, desc]) => {
            checkPageBreak(11)
            doc.text(`${letter}:  ${desc}`, margin + 5, y)
            y += 11
          })
          doc.setTextColor(0, 0, 0)
          y += 8
        }
      }
      const fileName = (species.species || 'species').replace(/[^a-z0-9]+/gi, '_').toLowerCase()
      doc.save(`${fileName}_${reportType}_report.pdf`)
    } catch (e: any) {
      alert('Error generating report: ' + e.message)
    } finally {
      setGeneratingReport(null)
    }
  }

  if (loading) return <div className="p-4">Loading...</div>
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>
  if (!species) return <div className="p-4">Species not found.</div>

  return (
    <div style={{maxWidth:'1500px',margin:'0 auto',padding:'24px 24px 96px',background:'#faf7f1',minHeight:'100vh'}}>
      <div className="flex justify-between items-center mb-3">
        <Link href="/" style={{color:'#5c7a2a',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>&larr; Back to list</Link>
        <div className="flex gap-3">
          {prevNext.prev && <Link href={`/species/${prevNext.prev}`} style={{color:'#5c7a2a',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>&#8592; Prev</Link>}
          {prevNext.next && <Link href={`/species/${prevNext.next}`} style={{color:'#5c7a2a',fontSize:'13px',fontWeight:600,textDecoration:'none'}}>Next &#8594;</Link>}
        </div>
      </div>
      <div className="flex gap-2 mb-5">
        <button type="button" onClick={() => generatePDF('basic')} disabled={generatingReport !== null} style={{fontSize:'12px',background:'#3f5228',color:'#fdfaf3',padding:'8px 14px',borderRadius:'8px',border:'none',cursor:'pointer',opacity:generatingReport!==null?0.5:1,fontWeight:600}}>
          {generatingReport === 'basic' ? 'Generating...' : '📄 Basic Report'}
        </button>
        <button type="button" onClick={() => generatePDF('advanced')} disabled={generatingReport !== null} style={{fontSize:'12px',background:'#7a9c42',color:'#1e2b12',padding:'8px 14px',borderRadius:'8px',border:'none',cursor:'pointer',opacity:generatingReport!==null?0.5:1,fontWeight:600}}>
          {generatingReport === 'advanced' ? 'Generating...' : '📄 Advanced Report'}
        </button>
      </div>
      <h1 style={{fontSize:'28px',fontWeight:700,color:'#2b2620',letterSpacing:'-0.01em'}}>{species.species}</h1>
      <p style={{fontSize:'13px',color:'#a89e7a',marginBottom:'18px'}}>sp_no: {species.sp_no}</p>
      {tubestockRows.length > 0 && (
        <div style={{
          background: '#eef3e4',
          border: '1px solid #cddba8',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '18px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5c7a2a', margin: '0 0 8px' }}>
            In Tubestock
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {tubestockRows.map(row => (
              <div key={row.id} style={{ fontSize: '13px', color: '#3f5228', display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                <span style={{ fontWeight: 600 }}>{row.quantity}&times;</span>
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '1px 8px', borderRadius: '20px',
                  background: row.status === 'growing_on' ? '#dceac0' : row.status === 'promoted' ? '#d8e3f5' : '#e5e5e5',
                  color: row.status === 'growing_on' ? '#3f5228' : row.status === 'promoted' ? '#2a4a7a' : '#6b6b6b',
                }}>
                  {row.status.replace('_', ' ')}
                </span>
                {row.source && <span style={{ color: '#7a6a3a' }}>{row.source}</span>}
                {row.acquisition_date && <span style={{ color: '#a89e7a' }}>{row.acquisition_date}</span>}
                {row.tubestock_number && <span style={{ color: '#a89e7a', fontFamily: 'monospace' }}>{row.tubestock_number}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <SpeciesPhotoField value={species.reference_photo || ''} onChange={v => updateSpecies('reference_photo', v)} />
      <div style={{marginBottom:'20px'}}>
        <label style={{display:'block',fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'#8a7f5f',marginBottom:'6px'}}>Quick Notes</label>
        <textarea value={species.research_notes || ''} onChange={(e) => updateSpecies('research_notes', e.target.value)} style={{width:'100%',minHeight:'110px',border:'1.5px solid #e2dac2',borderRadius:'10px',padding:'14px 16px',fontSize:'15px',lineHeight:1.6,fontFamily:'inherit',color:'#2b2620',background:'#fffefb',resize:'vertical',outline:'none'}} rows={4} placeholder="Voice-to-text notes go here..." />
      </div>
      <Section title="Species Info">
        <div>
          <label className="block text-sm font-medium mb-1">Research status</label>
          <select value={species.research_status || "Not Started"} onChange={e => updateSpecies("research_status", e.target.value)} className="w-full border rounded-lg px-3 py-2 text-base">
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Complete">Complete</option>
          </select>
        </div>
        <Field label="Species name" value={species.species} onChange={v => updateSpecies('species', v)} />
        <Field label="Common name" value={species.common_name} onChange={v => updateSpecies('common_name', v)} />
        <div className="flex gap-2">
          <div className="flex-1"><Field label="Genus" value={species.species_genus} onChange={v => updateSpecies('species_genus', v)} /></div>
          <div className="flex-1"><Field label="Epithet" value={species.species_epithet} onChange={v => updateSpecies('species_epithet', v)} /></div>
        </div>
        <Field label="Family" value={species.species_family} onChange={v => updateSpecies('species_family', v)} />
        <Field label="Tree type" value={species.tree_type} onChange={v => updateSpecies('tree_type', v)} />
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={species.pure_species || false} onChange={e => updateSpecies('pure_species', e.target.checked)} className="w-4 h-4" />
            Pure species
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={species.australian_native || false} onChange={e => updateSpecies('australian_native', e.target.checked)} className="w-4 h-4" />
            AU Native
          </label>
        </div>
        <div style={{ background: species.review_status === 'needs_review' ? '#fffbeb' : 'transparent', border: species.review_status === 'needs_review' ? '1px solid #fde68a' : 'none', borderRadius: '10px', padding: species.review_status === 'needs_review' ? '12px 14px' : '0', marginTop: '4px' }}>
          <label className="flex items-center gap-2 text-sm" style={{ marginBottom: species.review_status === 'needs_review' ? '10px' : '0' }}>
            <input
              type="checkbox"
              checked={species.review_status === 'needs_review'}
              onChange={e => updateSpecies('review_status', e.target.checked ? 'needs_review' : 'confirmed')}
              className="w-4 h-4"
            />
            Flag for review
          </label>
          {species.review_status === 'needs_review' && (
            <Field label="Review notes" value={species.review_notes} onChange={v => updateSpecies('review_notes', v)} type="textarea" />
          )}
        </div>
        <Field label="Origin" value={species.species_origin} onChange={v => updateSpecies('species_origin', v)} />
        <Field label="Natural habitat" value={species.natural_habitat} onChange={v => updateSpecies('natural_habitat', v)} />
        <Field label="Species notes" value={species.species_notes} onChange={v => updateSpecies('species_notes', v)} type="textarea" />
      </Section>
      {suitability && (
        <Section title="Bonsai Suitability">
          <Field label="Suitability" value={suitability.bonsai_suitability} onChange={v => updateSuitability('bonsai_suitability', v)} />
          <Field label="Difficulty" value={suitability.difficulty} onChange={v => updateSuitability('difficulty', v)} />
          <Field label="Recommended styles" value={suitability.recommended_bonsai_styles} onChange={v => updateSuitability('recommended_bonsai_styles', v)} type="textarea" />
          <Field label="Vigor" value={suitability.vigor} onChange={v => updateSuitability('vigor', v)} />
          <Field label="Vigor notes" value={suitability.vigor_notes} onChange={v => updateSuitability('vigor_notes', v)} type="textarea" />
          <Field label="Back budding ability" value={suitability.back_budding_ability} onChange={v => updateSuitability('back_budding_ability', v)} />
          <Field label="Back budding notes" value={suitability.back_budding_notes} onChange={v => updateSuitability('back_budding_notes', v)} type="textarea" />
          <Field label="Ramification potential" value={suitability.ramification_potential} onChange={v => updateSuitability('ramification_potential', v)} />
          <Field label="Ramification notes" value={suitability.ramification_notes} onChange={v => updateSuitability('ramification_notes', v)} type="textarea" />
          <Field label="Leaf reduction potential" value={suitability.leaf_reduction_potential} onChange={v => updateSuitability('leaf_reduction_potential', v)} />
          <Field label="Leaf reduction notes" value={suitability.leaf_reduction_notes} onChange={v => updateSuitability('leaf_reduction_notes', v)} type="textarea" />
          <Field label="Root tolerance score" value={suitability.root_tolerance_score} onChange={v => updateSuitability('root_tolerance_score', v)} />
          <Field label="Root tolerance notes" value={suitability.root_tolerance_notes} onChange={v => updateSuitability('root_tolerance_notes', v)} type="textarea" />
          <Field label="Final bonsai score" value={suitability.final_bonsai_score} onChange={v => updateSuitability('final_bonsai_score', v)} />
          <Field label="Tier" value={suitability.bonsai_tier} onChange={v => updateSuitability('bonsai_tier', v)} />
        </Section>
      )}
      {careGuide && (
        <Section title="Care Guide">
          <Field label="Growth season" value={careGuide.growth_season} onChange={v => updateCareGuide('growth_season', v)} type="textarea" />
          <Field label="Growth season notes" value={careGuide.growth_season_notes} onChange={v => updateCareGuide('growth_season_notes', v)} type="textarea" />
          <Field label="Growth plan" value={careGuide.growth_plan} onChange={v => updateCareGuide('growth_plan', v)} type="textarea" />
          <Field label="Watering" value={careGuide.watering} onChange={v => updateCareGuide('watering', v)} type="textarea" />
          <Field label="Watering frequency" value={careGuide.watering_frequency} onChange={v => updateCareGuide('watering_frequency', v)} type="textarea" />
          <Field label="Sun exposure" value={careGuide.sun_exposure} onChange={v => updateCareGuide('sun_exposure', v)} type="textarea" />
          <Field label="Light requirements" value={careGuide.light_requirements} onChange={v => updateCareGuide('light_requirements', v)} type="textarea" />
          <Field label="Fertilizing" value={careGuide.fertilizing} onChange={v => updateCareGuide('fertilizing', v)} type="textarea" />
          <Field label="Best fertiliser (Australia)" value={careGuide.best_fertiliser_australia} onChange={v => updateCareGuide('best_fertiliser_australia', v)} type="textarea" />
          <Field label="Promote growth" value={careGuide.promote_growth} onChange={v => updateCareGuide('promote_growth', v)} type="textarea" />
          <Field label="Promote back budding" value={careGuide.promote_back_budding} onChange={v => updateCareGuide('promote_back_budding', v)} type="textarea" />
          <Field label="Style options" value={careGuide.style_options} onChange={v => updateCareGuide('style_options', v)} type="textarea" />
          <Field label="Styling considerations" value={careGuide.styling_considerations} onChange={v => updateCareGuide('styling_considerations', v)} type="textarea" />
          <Field label="Technical training & styling" value={careGuide.technical_training_styling} onChange={v => updateCareGuide('technical_training_styling', v)} type="textarea" />
          <Field label="Pruning & refinement protocols" value={careGuide.pruning_refinement_protocols} onChange={v => updateCareGuide('pruning_refinement_protocols', v)} type="textarea" />
          <Field label="Wiring" value={careGuide.wiring} onChange={v => updateCareGuide('wiring', v)} type="textarea" />
          <Field label="Branch direction after wiring" value={careGuide.branch_direction_after_wiring} onChange={v => updateCareGuide('branch_direction_after_wiring', v)} type="textarea" />
          <Field label="Repotting guide" value={careGuide.repotting_guide} onChange={v => updateCareGuide('repotting_guide', v)} type="textarea" />
          <Field label="Best soil mix" value={careGuide.best_soil_mix} onChange={v => updateCareGuide('best_soil_mix', v)} type="textarea" />
          <Field label="Pests & diseases" value={careGuide.pests_and_diseases} onChange={v => updateCareGuide('pests_and_diseases', v)} type="textarea" />
          <Field label="Climate zone" value={careGuide.climate_zone} onChange={v => updateCareGuide('climate_zone', v)} type="textarea" />
          <Field label="Watering (summer)" value={careGuide.watering_summer_notes} onChange={v => updateCareGuide('watering_summer_notes', v)} type="textarea" />
          <Field label="Watering (winter)" value={careGuide.watering_winter_notes} onChange={v => updateCareGuide('watering_winter_notes', v)} type="textarea" />
          <Field label="Summer sun protection" value={careGuide.summer_sun_protection} onChange={v => updateCareGuide('summer_sun_protection', v)} type="textarea" />
          <Field label="Frost risk" value={careGuide.frost_risk} onChange={v => updateCareGuide('frost_risk', v)} type="textarea" />
          <Field label="Min temp (C)" value={careGuide.min_temp_c} onChange={v => updateCareGuide('min_temp_c', v)} />
          <Field label="Pruning season" value={careGuide.pruning_season} onChange={v => updateCareGuide('pruning_season', v)} type="textarea" />
          <Field label="Repotting season" value={careGuide.repotting_season} onChange={v => updateCareGuide('repotting_season', v)} type="textarea" />
          <Field label="Repotting frequency (yrs)" value={careGuide.repotting_freq_yrs} onChange={v => updateCareGuide('repotting_freq_yrs', v)} />
        </Section>
      )}
      {fertilisation && (
        <Section title="Fertilisation">
          <Field label="P tolerance" value={fertilisation.p_tolerance} onChange={v => updateFertilisation('p_tolerance', v)} type="textarea" />
          <Field label="N requirement" value={fertilisation.n_requirement} onChange={v => updateFertilisation('n_requirement', v)} type="textarea" />
          <Field label="Preferred fertiliser types" value={fertilisation.preferred_fertiliser_types} onChange={v => updateFertilisation('preferred_fertiliser_types', v)} type="textarea" />
          <Field label="Avoid fertilisers" value={fertilisation.avoid_fertilisers} onChange={v => updateFertilisation('avoid_fertilisers', v)} type="textarea" />
          <Field label="Recommended products" value={fertilisation.recommended_products} onChange={v => updateFertilisation('recommended_products', v)} type="textarea" />
          <Field label="Notes" value={fertilisation.notes_schema} onChange={v => updateFertilisation('notes_schema', v)} type="textarea" />
        </Section>
      )}
      {tubestockDev && (
        <Section title="Tubestock Development">
          <Field label="Species (record label)" value={tubestockDev.species} onChange={v => updateTubestockDev('species', v)} />
          <Field label="Establishment period (weeks)" value={tubestockDev.establishment_period_weeks} onChange={v => updateTubestockDev('establishment_period_weeks', v)} />
          <Field label="Survival rate notes" value={tubestockDev.survival_rate_notes} onChange={v => updateTubestockDev('survival_rate_notes', v)} type="textarea" />
          <Field label="Common failures" value={tubestockDev.common_failures} onChange={v => updateTubestockDev('common_failures', v)} type="textarea" />
          <Field label="Tubestock potting mix" value={tubestockDev.tubestock_potting_mix} onChange={v => updateTubestockDev('tubestock_potting_mix', v)} type="textarea" />
          <Field label="First pot size" value={tubestockDev.first_pot_size} onChange={v => updateTubestockDev('first_pot_size', v)} />
          <Field label="Potting-on schedule" value={tubestockDev.potting_on_schedule} onChange={v => updateTubestockDev('potting_on_schedule', v)} type="textarea" />
          <Field label="Initial potting timing" value={tubestockDev.initial_potting_timing} onChange={v => updateTubestockDev('initial_potting_timing', v)} type="textarea" />
          <Field label="Watering frequency" value={tubestockDev.watering_frequency} onChange={v => updateTubestockDev('watering_frequency', v)} type="textarea" />
          <Field label="Fertilising regime" value={tubestockDev.fertilising_regime} onChange={v => updateTubestockDev('fertilising_regime', v)} type="textarea" />
          <Field label="Recommended fertiliser" value={tubestockDev.recommended_fertiliser} onChange={v => updateTubestockDev('recommended_fertiliser', v)} type="textarea" />
          <Field label="Growth rate expected" value={tubestockDev.growth_rate_expected} onChange={v => updateTubestockDev('growth_rate_expected', v)} />
          <Field label="First pruning timing" value={tubestockDev.first_pruning_timing} onChange={v => updateTubestockDev('first_pruning_timing', v)} type="textarea" />
          <Field label="First structure timing" value={tubestockDev.first_structure_timing} onChange={v => updateTubestockDev('first_structure_timing', v)} type="textarea" />
          <Field label="Root establishment notes" value={tubestockDev.root_establishment_notes} onChange={v => updateTubestockDev('root_establishment_notes', v)} type="textarea" />
          <Field label="Nursery to training pot" value={tubestockDev.nursery_to_training_pot} onChange={v => updateTubestockDev('nursery_to_training_pot', v)} type="textarea" />
          <Field label="Revegetation planting notes" value={tubestockDev.revegetation_planting_notes} onChange={v => updateTubestockDev('revegetation_planting_notes', v)} type="textarea" />
          <Field label="Establishment in ground" value={tubestockDev.establishment_in_ground} onChange={v => updateTubestockDev('establishment_in_ground', v)} type="textarea" />
          <Field label="Weed competition tolerance" value={tubestockDev.weed_competition_tolerance} onChange={v => updateTubestockDev('weed_competition_tolerance', v)} />
          <Field label="Irrigation requirement" value={tubestockDev.irrigation_requirement} onChange={v => updateTubestockDev('irrigation_requirement', v)} type="textarea" />
          <Field label="Species-specific notes" value={tubestockDev.species_specific_notes} onChange={v => updateTubestockDev('species_specific_notes', v)} type="textarea" />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={tubestockDev.record_complete || false} onChange={e => updateTubestockDev('record_complete', e.target.checked)} className="w-4 h-4" />
              Record complete
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={tubestockDev.needs_verification || false} onChange={e => updateTubestockDev('needs_verification', e.target.checked)} className="w-4 h-4" />
              Needs verification
            </label>
          </div>
          <Field label="Last updated" value={tubestockDev.last_updated} onChange={v => updateTubestockDev('last_updated', v)} />
          <Field label="Research status" value={tubestockDev.research_status} onChange={v => updateTubestockDev('research_status', v)} />
          <Field label="Data source" value={tubestockDev.data_source} onChange={v => updateTubestockDev('data_source', v)} type="textarea" />
          <Field label="Research notes" value={tubestockDev.research_notes} onChange={v => updateTubestockDev('research_notes', v)} type="textarea" />
          <Field label="Reference URLs" value={tubestockDev.reference_urls} onChange={v => updateTubestockDev('reference_urls', v)} type="textarea" />
        </Section>
      )}
      {pruning && (
        <Section title="Pruning Protocols">
          <Field label="Core rules" value={pruning.pruning_core_rules} onChange={v => updatePruning('pruning_core_rules', v)} type="textarea" />
          <Field label="Structural pruning timing" value={pruning.structural_pruning_timing} onChange={v => updatePruning('structural_pruning_timing', v)} type="textarea" />
          <Field label="Structural pruning method" value={pruning.structural_pruning_method} onChange={v => updatePruning('structural_pruning_method', v)} type="textarea" />
          <Field label="Structural pruning limits" value={pruning.structural_pruning_limits} onChange={v => updatePruning('structural_pruning_limits', v)} type="textarea" />
          <Field label="Post-flowering pruning timing" value={pruning.post_flowering_pruning_timing} onChange={v => updatePruning('post_flowering_pruning_timing', v)} type="textarea" />
          <Field label="Post-flowering pruning method" value={pruning.post_flowering_pruning_method} onChange={v => updatePruning('post_flowering_pruning_method', v)} type="textarea" />
          <Field label="Maintenance pruning timing" value={pruning.maintenance_pruning_timing} onChange={v => updatePruning('maintenance_pruning_timing', v)} type="textarea" />
          <Field label="Maintenance pruning method" value={pruning.maintenance_pruning_method} onChange={v => updatePruning('maintenance_pruning_method', v)} type="textarea" />
          <Field label="Old wood management" value={pruning.old_wood_management} onChange={v => updatePruning('old_wood_management', v)} type="textarea" />
          <Field label="Seasonal timing" value={pruning.seasonal_timing_seq} onChange={v => updatePruning('seasonal_timing_seq', v)} type="textarea" />
          <Field label="Recommended techniques" value={pruning.recommended_techniques} onChange={v => updatePruning('recommended_techniques', v)} type="textarea" />
          <Field label="Common mistakes" value={pruning.common_mistakes} onChange={v => updatePruning('common_mistakes', v)} type="textarea" />
          <Field label="Apical management" value={pruning.apical_management_strategy} onChange={v => updatePruning('apical_management_strategy', v)} type="textarea" />
          <Field label="Branch selection rules" value={pruning.branch_selection_rules} onChange={v => updatePruning('branch_selection_rules', v)} type="textarea" />
          <Field label="Light penetration strategy" value={pruning.light_penetration_strategy} onChange={v => updatePruning('light_penetration_strategy', v)} type="textarea" />
          <Field label="Refinement method" value={pruning.refinement_method} onChange={v => updatePruning('refinement_method', v)} type="textarea" />
          <Field label="Notes" value={pruning.notes} onChange={v => updatePruning('notes', v)} type="textarea" />
        </Section>
      )}
      {nebari && (
        <Section title="Nebari and Root">
          <Field label="Root architecture type" value={nebari.root_architecture_type} onChange={v => updateNebari('root_architecture_type', v)} />
          <Field label="Natural nebari form" value={nebari.natural_nebari_form} onChange={v => updateNebari('natural_nebari_form', v)} type="textarea" />
          <Field label="Root depth tendency" value={nebari.root_depth_tendency} onChange={v => updateNebari('root_depth_tendency', v)} />
          <Field label="Root spread behaviour" value={nebari.root_spread_behaviour} onChange={v => updateNebari('root_spread_behaviour', v)} type="textarea" />
          <Field label="Development speed" value={nebari.development_speed} onChange={v => updateNebari('development_speed', v)} />
          <Field label="Years to initial nebari" value={nebari.years_to_initial_nebari} onChange={v => updateNebari('years_to_initial_nebari', v)} />
          <Field label="Years to mature nebari" value={nebari.years_to_mature_nebari} onChange={v => updateNebari('years_to_mature_nebari', v)} />
          <Field label="Climate influence" value={nebari.climate_influence_seq} onChange={v => updateNebari('climate_influence_seq', v)} type="textarea" />
          <Field label="Taproot removal tolerance" value={nebari.taproot_removal_tolerance} onChange={v => updateNebari('taproot_removal_tolerance', v)} />
          <Field label="Radial root pruning response" value={nebari.radial_root_pruning_response} onChange={v => updateNebari('radial_root_pruning_response', v)} type="textarea" />
          <Field label="Root reduction tolerance" value={nebari.root_reduction_tolerance} onChange={v => updateNebari('root_reduction_tolerance', v)} />
          <Field label="Fine root production" value={nebari.fine_root_production} onChange={v => updateNebari('fine_root_production', v)} />
          <Field label="Root rot susceptibility" value={nebari.root_rot_susceptibility} onChange={v => updateNebari('root_rot_susceptibility', v)} />
          <Field label="Ground layering suitability" value={nebari.ground_layering_suitability} onChange={v => updateNebari('ground_layering_suitability', v)} />
          <Field label="Tourniquet method suitability" value={nebari.tourniquet_method_suitability} onChange={v => updateNebari('tourniquet_method_suitability', v)} />
          <Field label="Root grafting success rate" value={nebari.root_grafting_success_rate} onChange={v => updateNebari('root_grafting_success_rate', v)} />
          <Field label="Nebari fusion potential" value={nebari.nebari_fusion_potential} onChange={v => updateNebari('nebari_fusion_potential', v)} />
          <Field label="Best techniques" value={nebari.best_techniques_for_species} onChange={v => updateNebari('best_techniques_for_species', v)} type="textarea" />
          <Field label="Typical nebari faults" value={nebari.typical_nebari_faults} onChange={v => updateNebari('typical_nebari_faults', v)} type="textarea" />
          <Field label="Underlying causes" value={nebari.underlying_causes} onChange={v => updateNebari('underlying_causes', v)} type="textarea" />
          <Field label="Corrective strategies" value={nebari.corrective_strategies} onChange={v => updateNebari('corrective_strategies', v)} type="textarea" />
          <Field label="Preferred pot depth" value={nebari.preferred_pot_depth} onChange={v => updateNebari('preferred_pot_depth', v)} />
          <Field label="Preferred pot width" value={nebari.preferred_pot_width} onChange={v => updateNebari('preferred_pot_width', v)} />
          <Field label="Surface substrate preference" value={nebari.surface_substrate_preference} onChange={v => updateNebari('surface_substrate_preference', v)} />
          <Field label="Moisture preference" value={nebari.moisture_preference} onChange={v => updateNebari('moisture_preference', v)} />
          <Field label="Heat sensitivity at root base" value={nebari.heat_sensitivity_at_root_base} onChange={v => updateNebari('heat_sensitivity_at_root_base', v)} />
          <Field label="Ultimate nebari quality potential" value={nebari.ultimate_nebari_quality_potential} onChange={v => updateNebari('ultimate_nebari_quality_potential', v)} />
          <Field label="Expected mature nebari form" value={nebari.expected_mature_nebari_form} onChange={v => updateNebari('expected_mature_nebari_form', v)} type="textarea" />
          <Field label="Maintenance requirements" value={nebari.maintenance_requirements} onChange={v => updateNebari('maintenance_requirements', v)} type="textarea" />
          <Field label="Ageing notes" value={nebari.ageing_notes} onChange={v => updateNebari('ageing_notes', v)} type="textarea" />
          <Field label="Notes for future development" value={nebari.notes_for_future_development} onChange={v => updateNebari('notes_for_future_development', v)} type="textarea" />
        </Section>
      )}
      {seasonal && (
        <Section title="Seasonal Maintenance">
          <Field label="Spring guide" value={seasonal.spring_maintenance_guide} onChange={v => updateSeasonal('spring_maintenance_guide', v)} type="textarea" />
          <Field label="Summer guide" value={seasonal.summer_maintenance_guide} onChange={v => updateSeasonal('summer_maintenance_guide', v)} type="textarea" />
          <Field label="Autumn guide" value={seasonal.autumn_maintenance_guide} onChange={v => updateSeasonal('autumn_maintenance_guide', v)} type="textarea" />
          <Field label="Winter guide" value={seasonal.winter_maintenance_guide} onChange={v => updateSeasonal('winter_maintenance_guide', v)} type="textarea" />
          <Field label="General maintenance notes" value={seasonal.general_maintenance_notes} onChange={v => updateSeasonal('general_maintenance_notes', v)} type="textarea" />
          <Field label="Spring care" value={seasonal.spring_care} onChange={v => updateSeasonal('spring_care', v)} type="textarea" />
          <Field label="Summer care" value={seasonal.summer_care} onChange={v => updateSeasonal('summer_care', v)} type="textarea" />
          <Field label="Autumn care" value={seasonal.autumn_care} onChange={v => updateSeasonal('autumn_care', v)} type="textarea" />
          <Field label="Winter care" value={seasonal.winter_care} onChange={v => updateSeasonal('winter_care', v)} type="textarea" />
        </Section>
      )}
      {advanced && (
        <Section title="Advanced and Expert">
          <Field label="pH target" value={advanced.ph_target} onChange={v => updateAdvanced('ph_target', v)} />
          <Field label="Back budding notes" value={advanced.backbudding_notes} onChange={v => updateAdvanced('backbudding_notes', v)} type="textarea" />
          <Field label="Ramification stages" value={advanced.ramification_stages} onChange={v => updateAdvanced('ramification_stages', v)} type="textarea" />
          <Field label="Root notes" value={advanced.root_notes} onChange={v => updateAdvanced('root_notes', v)} type="textarea" />
          <Field label="Hormonal model" value={advanced.hormonal_model} onChange={v => updateAdvanced('hormonal_model', v)} type="textarea" />
          <Field label="Needle control" value={advanced.needle_control} onChange={v => updateAdvanced('needle_control', v)} type="textarea" />
          <Field label="Climate notes" value={advanced.climate_notes} onChange={v => updateAdvanced('climate_notes', v)} type="textarea" />
          <Field label="Repotting season notes" value={advanced.repotting_season_notes} onChange={v => updateAdvanced('repotting_season_notes', v)} type="textarea" />
          <Field label="Styling biomechanics" value={advanced.styling_biomechanics} onChange={v => updateAdvanced('styling_biomechanics', v)} type="textarea" />
          <Field label="Morphology notes" value={advanced.morphology_notes} onChange={v => updateAdvanced('morphology_notes', v)} type="textarea" />
          <Field label="Cambial notes" value={advanced.cambial_notes} onChange={v => updateAdvanced('cambial_notes', v)} type="textarea" />
          <Field label="Seasonal physiology" value={advanced.seasonal_physiology} onChange={v => updateAdvanced('seasonal_physiology', v)} type="textarea" />
          <Field label="Energy model" value={advanced.energy_model} onChange={v => updateAdvanced('energy_model', v)} type="textarea" />
          <Field label="Acquisition and raw material" value={advanced.acquisition_raw_material} onChange={v => updateAdvanced('acquisition_raw_material', v)} type="textarea" />
          <Field label="Aesthetics and exhibition philosophy" value={advanced.aesthetics_exhibition_philosophy} onChange={v => updateAdvanced('aesthetics_exhibition_philosophy', v)} type="textarea" />
          <Field label="Advanced structural engineering" value={advanced.advanced_structural_engineering} onChange={v => updateAdvanced('advanced_structural_engineering', v)} type="textarea" />
          <Field label="Development years 1-3" value={advanced.development_years_1_3} onChange={v => updateAdvanced('development_years_1_3', v)} type="textarea" />
          <Field label="Development years 4-6" value={advanced.development_years_4_6} onChange={v => updateAdvanced('development_years_4_6', v)} type="textarea" />
          <Field label="Development years 7-8" value={advanced.development_years_7_8} onChange={v => updateAdvanced('development_years_7_8', v)} type="textarea" />
          <Field label="Development years 9-10" value={advanced.development_years_9_10} onChange={v => updateAdvanced('development_years_9_10', v)} type="textarea" />
        </Section>
      )}
      <Section title="Variants">
        <VariantsSection spNo={spNo as string} />
      </Section>
      {regional && (
        <Section title="Regional Suitability">
          <Field label="Tropical suitability" value={regional.tropical_suitability} onChange={v => updateRegional('tropical_suitability', v)} />
          <Field label="Tropical notes" value={regional.tropical_notes} onChange={v => updateRegional('tropical_notes', v)} type="textarea" />
          <Field label="Tropical risk" value={regional.tropical_risk} onChange={v => updateRegional('tropical_risk', v)} />
          <Field label="Tropical training adjustments" value={regional.tropical_training_adjustments} onChange={v => updateRegional('tropical_training_adjustments', v)} type="textarea" />
          <Field label="Tropical soil modifier" value={regional.tropical_soil_modifier} onChange={v => updateRegional('tropical_soil_modifier', v)} type="textarea" />
          <Field label="Tropical watering modifier" value={regional.tropical_watering_modifier} onChange={v => updateRegional('tropical_watering_modifier', v)} type="textarea" />
          <Field label="Subtropical suitability" value={regional.subtropical_suitability} onChange={v => updateRegional('subtropical_suitability', v)} />
          <Field label="Subtropical notes" value={regional.subtropical_notes} onChange={v => updateRegional('subtropical_notes', v)} type="textarea" />
          <Field label="Subtropical risk" value={regional.subtropical_risk} onChange={v => updateRegional('subtropical_risk', v)} />
          <Field label="Subtropical training adjustments" value={regional.subtropical_training_adjustments} onChange={v => updateRegional('subtropical_training_adjustments', v)} type="textarea" />
          <Field label="Subtropical soil modifier" value={regional.subtropical_soil_modifier} onChange={v => updateRegional('subtropical_soil_modifier', v)} type="textarea" />
          <Field label="Subtropical watering modifier" value={regional.subtropical_watering_modifier} onChange={v => updateRegional('subtropical_watering_modifier', v)} type="textarea" />
          <Field label="Temperate suitability" value={regional.temperate_suitability} onChange={v => updateRegional('temperate_suitability', v)} />
          <Field label="Temperate notes" value={regional.temperate_notes} onChange={v => updateRegional('temperate_notes', v)} type="textarea" />
          <Field label="Temperate risk" value={regional.temperate_risk} onChange={v => updateRegional('temperate_risk', v)} />
          <Field label="Temperate training adjustments" value={regional.temperate_training_adjustments} onChange={v => updateRegional('temperate_training_adjustments', v)} type="textarea" />
          <Field label="Temperate soil modifier" value={regional.temperate_soil_modifier} onChange={v => updateRegional('temperate_soil_modifier', v)} type="textarea" />
          <Field label="Temperate watering modifier" value={regional.temperate_watering_modifier} onChange={v => updateRegional('temperate_watering_modifier', v)} type="textarea" />
          <Field label="Cold suitability" value={regional.cold_suitability} onChange={v => updateRegional('cold_suitability', v)} />
          <Field label="Cold notes" value={regional.cold_notes} onChange={v => updateRegional('cold_notes', v)} type="textarea" />
          <Field label="Cold risk" value={regional.cold_risk} onChange={v => updateRegional('cold_risk', v)} />
          <Field label="Cold training adjustments" value={regional.cold_training_adjustments} onChange={v => updateRegional('cold_training_adjustments', v)} type="textarea" />
          <Field label="Cold soil modifier" value={regional.cold_soil_modifier} onChange={v => updateRegional('cold_soil_modifier', v)} type="textarea" />
          <Field label="Cold watering modifier" value={regional.cold_watering_modifier} onChange={v => updateRegional('cold_watering_modifier', v)} type="textarea" />
          <Field label="Availability (Australia)" value={regional.availability_australia} onChange={v => updateRegional('availability_australia', v)} />
          <Field label="Availability notes" value={regional.availability_notes} onChange={v => updateRegional('availability_notes', v)} type="textarea" />
          <Field label="Nursery availability" value={regional.nursery_availability} onChange={v => updateRegional('nursery_availability', v)} />
          <Field label="Wild collection status" value={regional.wild_collection_status} onChange={v => updateRegional('wild_collection_status', v)} />
        </Section>
      )}
      {placement && (
        <Section title="Placement Matrix">
          <Field label="Full sun" value={placement.exposure_full_sun} onChange={v => updatePlacement('exposure_full_sun', v)} />
          <Field label="Morning sun" value={placement.exposure_morning_sun} onChange={v => updatePlacement('exposure_morning_sun', v)} />
          <Field label="Dappled shade" value={placement.exposure_dappled_shade} onChange={v => updatePlacement('exposure_dappled_shade', v)} />
          <Field label="Full shade" value={placement.exposure_full_shade} onChange={v => updatePlacement('exposure_full_shade', v)} />
          <Field label="Variable E" value={placement.exposure_variable_e} onChange={v => updatePlacement('exposure_variable_e', v)} />
          <Field label="Variable F" value={placement.exposure_variable_f} onChange={v => updatePlacement('exposure_variable_f', v)} />
          <Field label="SEQ notes" value={placement.seq_notes} onChange={v => updatePlacement('seq_notes', v)} type="textarea" />
          <Field label="National notes" value={placement.national_notes} onChange={v => updatePlacement('national_notes', v)} type="textarea" />
        </Section>
      )}
      {toxicity && (
        <Section title="Toxicity">
          <Field label="Toxicity level" value={toxicity.toxicity_level} onChange={v => updateToxicity('toxicity_level', v)} />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={toxicity.toxic_to_humans || false} onChange={e => updateToxicity('toxic_to_humans', e.target.checked)} className="w-4 h-4" />
              Toxic to humans
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={toxicity.toxic_to_pets || false} onChange={e => updateToxicity('toxic_to_pets', e.target.checked)} className="w-4 h-4" />
              Toxic to pets
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={toxicity.toxic_to_livestock || false} onChange={e => updateToxicity('toxic_to_livestock', e.target.checked)} className="w-4 h-4" />
              Toxic to livestock
            </label>
          </div>
          <Field label="Toxic parts" value={toxicity.toxic_parts} onChange={v => updateToxicity('toxic_parts', v)} type="textarea" />
          <Field label="Toxic principle" value={toxicity.toxic_principle} onChange={v => updateToxicity('toxic_principle', v)} />
          <Field label="Symptoms" value={toxicity.symptoms} onChange={v => updateToxicity('symptoms', v)} type="textarea" />
          <Field label="Severity notes" value={toxicity.severity_notes} onChange={v => updateToxicity('severity_notes', v)} type="textarea" />
          <Field label="First aid notes" value={toxicity.first_aid_notes} onChange={v => updateToxicity('first_aid_notes', v)} type="textarea" />
        </Section>
      )}
      <div className="mt-6 mb-10 flex justify-between items-center">
        {saveMessage && <span style={{fontSize:'13px',color:'#5c7a2a',fontWeight:600}}>{saveMessage}</span>}
        <button onClick={handleSave} disabled={saving} style={{marginLeft:'auto',background:'#3f5228',color:'#fdfaf3',padding:'16px 24px',borderRadius:'12px',fontWeight:700,width:'100%',fontSize:'17px',border:'none',cursor:'pointer',opacity:saving?0.5:1,boxShadow:'0 2px 10px rgba(63,82,40,0.2)'}}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
