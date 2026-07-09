'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

type FieldType = 'text' | 'number' | 'bool'

interface TableConfig {
  label: string
  table: string
  columns: string[]
  types: Record<string, FieldType>
}

const TABLES: Record<string, TableConfig> = {
  seasonal: {
    label: 'Seasonal',
    table: 'seasonal_maintenance',
    columns: ['sp_no', 'spring_maintenance_guide', 'summer_maintenance_guide', 'autumn_maintenance_guide', 'winter_maintenance_guide', 'general_maintenance_notes', 'spring_care', 'summer_care', 'autumn_care', 'winter_care', 'research_status', 'data_source', 'research_notes'],
    types: {
      sp_no: 'number', spring_maintenance_guide: 'text', summer_maintenance_guide: 'text',
      autumn_maintenance_guide: 'text', winter_maintenance_guide: 'text', general_maintenance_notes: 'text',
      spring_care: 'text', summer_care: 'text', autumn_care: 'text', winter_care: 'text',
      research_status: 'text', data_source: 'text', research_notes: 'text',
    },
  },
  fertiliser: {
    label: 'Fertiliser',
    table: 'fertilisation',
    columns: ['sp_no', 'p_tolerance', 'n_requirement', 'preferred_fertiliser_types', 'avoid_fertilisers', 'recommended_products', 'notes_schema', 'research_status', 'data_source', 'research_notes'],
    types: {
      sp_no: 'number', p_tolerance: 'text', n_requirement: 'text', preferred_fertiliser_types: 'text',
      avoid_fertilisers: 'text', recommended_products: 'text', notes_schema: 'text',
      research_status: 'text', data_source: 'text', research_notes: 'text',
    },
  },
  pruning: {
    label: 'Pruning',
    table: 'pruning_protocols',
    columns: ['sp_no', 'pruning_core_rules', 'structural_pruning_timing', 'structural_pruning_method', 'structural_pruning_limits', 'post_flowering_pruning_timing', 'post_flowering_pruning_method', 'maintenance_pruning_timing', 'maintenance_pruning_method', 'old_wood_management', 'seasonal_timing_seq', 'recommended_techniques', 'common_mistakes', 'apical_management_strategy', 'branch_selection_rules', 'light_penetration_strategy', 'refinement_method', 'notes', 'research_status', 'data_source', 'research_notes'],
    types: {
      sp_no: 'number', pruning_core_rules: 'text', structural_pruning_timing: 'text', structural_pruning_method: 'text',
      structural_pruning_limits: 'text', post_flowering_pruning_timing: 'text', post_flowering_pruning_method: 'text',
      maintenance_pruning_timing: 'text', maintenance_pruning_method: 'text', old_wood_management: 'text',
      seasonal_timing_seq: 'text', recommended_techniques: 'text', common_mistakes: 'text',
      apical_management_strategy: 'text', branch_selection_rules: 'text', light_penetration_strategy: 'text',
      refinement_method: 'text', notes: 'text', research_status: 'text', data_source: 'text', research_notes: 'text',
    },
  },
  nebari: {
    label: 'Nebari',
    table: 'nebari_root',
    columns: ['sp_no', 'root_architecture_type', 'natural_nebari_form', 'root_depth_tendency', 'root_spread_behaviour', 'development_speed', 'years_to_initial_nebari', 'years_to_mature_nebari', 'climate_influence_seq', 'taproot_removal_tolerance', 'radial_root_pruning_response', 'root_reduction_tolerance', 'fine_root_production', 'root_rot_susceptibility', 'ground_layering_suitability', 'tourniquet_method_suitability', 'root_grafting_success_rate', 'nebari_fusion_potential', 'best_techniques_for_species', 'typical_nebari_faults', 'underlying_causes', 'corrective_strategies', 'preferred_pot_depth', 'preferred_pot_width', 'surface_substrate_preference', 'moisture_preference', 'heat_sensitivity_at_root_base', 'ultimate_nebari_quality_potential', 'expected_mature_nebari_form', 'maintenance_requirements', 'ageing_notes', 'notes_for_future_development', 'research_status', 'data_source', 'research_notes'],
    types: {
      sp_no: 'number', root_architecture_type: 'text', natural_nebari_form: 'text', root_depth_tendency: 'text',
      root_spread_behaviour: 'text', development_speed: 'text', years_to_initial_nebari: 'text', years_to_mature_nebari: 'text',
      climate_influence_seq: 'text', taproot_removal_tolerance: 'text', radial_root_pruning_response: 'text',
      root_reduction_tolerance: 'text', fine_root_production: 'text', root_rot_susceptibility: 'text',
      ground_layering_suitability: 'text', tourniquet_method_suitability: 'text', root_grafting_success_rate: 'text',
      nebari_fusion_potential: 'text', best_techniques_for_species: 'text', typical_nebari_faults: 'text',
      underlying_causes: 'text', corrective_strategies: 'text', preferred_pot_depth: 'text', preferred_pot_width: 'text',
      surface_substrate_preference: 'text', moisture_preference: 'text', heat_sensitivity_at_root_base: 'text',
      ultimate_nebari_quality_potential: 'text', expected_mature_nebari_form: 'text', maintenance_requirements: 'text',
      ageing_notes: 'text', notes_for_future_development: 'text', research_status: 'text', data_source: 'text', research_notes: 'text',
    },
  },
  regional: {
    label: 'Regional',
    table: 'regional_suitability',
    columns: ['sp_no', 'tropical_suitability', 'tropical_notes', 'tropical_risk', 'tropical_training_adjustments', 'tropical_soil_modifier', 'tropical_watering_modifier', 'subtropical_suitability', 'subtropical_notes', 'subtropical_risk', 'subtropical_training_adjustments', 'subtropical_soil_modifier', 'subtropical_watering_modifier', 'temperate_suitability', 'temperate_notes', 'temperate_risk', 'temperate_training_adjustments', 'temperate_soil_modifier', 'temperate_watering_modifier', 'cold_suitability', 'cold_notes', 'cold_risk', 'cold_training_adjustments', 'cold_soil_modifier', 'cold_watering_modifier', 'availability_australia', 'availability_notes', 'nursery_availability'],
    types: {
      sp_no: 'number', tropical_suitability: 'text', tropical_notes: 'text', tropical_risk: 'text',
      tropical_training_adjustments: 'text', tropical_soil_modifier: 'text', tropical_watering_modifier: 'text',
      subtropical_suitability: 'text', subtropical_notes: 'text', subtropical_risk: 'text',
      subtropical_training_adjustments: 'text', subtropical_soil_modifier: 'text', subtropical_watering_modifier: 'text',
      temperate_suitability: 'text', temperate_notes: 'text', temperate_risk: 'text',
      temperate_training_adjustments: 'text', temperate_soil_modifier: 'text', temperate_watering_modifier: 'text',
      cold_suitability: 'text', cold_notes: 'text', cold_risk: 'text', cold_training_adjustments: 'text',
      cold_soil_modifier: 'text', cold_watering_modifier: 'text', availability_australia: 'text',
      availability_notes: 'text', nursery_availability: 'text',
    },
  },
  suitability: {
    label: 'Suitability',
    table: 'bonsai_suitability',
    columns: ['sp_no', 'bonsai_suitability', 'difficulty', 'recommended_bonsai_styles', 'vigor', 'vigor_notes', 'back_budding_ability', 'back_budding_notes', 'ramification_potential', 'ramification_notes', 'leaf_reduction_potential', 'leaf_reduction_notes', 'root_tolerance_score', 'root_tolerance_notes', 'final_bonsai_score', 'bonsai_tier', 'research_status', 'data_source', 'research_notes', 'needs_verification'],
    types: {
      sp_no: 'number', bonsai_suitability: 'text', difficulty: 'text', recommended_bonsai_styles: 'text',
      vigor: 'number', vigor_notes: 'text', back_budding_ability: 'number', back_budding_notes: 'text',
      ramification_potential: 'number', ramification_notes: 'text', leaf_reduction_potential: 'number',
      leaf_reduction_notes: 'text', root_tolerance_score: 'number', root_tolerance_notes: 'text',
      final_bonsai_score: 'number', bonsai_tier: 'text', research_status: 'text', data_source: 'text',
      research_notes: 'text', needs_verification: 'bool',
    },
  },
  species: {
    label: 'Species',
    table: 'species',
    columns: ['sp_no', 'species', 'pure_species', 'species_epithet', 'cultivar', 'species_genus', 'common_name', 'species_family', 'tree_type', 'australian_native', 'species_origin', 'species_notes', 'natural_habitat'],
    types: {
      sp_no: 'number', species: 'text', pure_species: 'bool', species_epithet: 'text',
      cultivar: 'text', species_genus: 'text', common_name: 'text', species_family: 'text',
      tree_type: 'text', australian_native: 'bool', species_origin: 'text',
      species_notes: 'text', natural_habitat: 'text',
    },
  },
  variants: {
    label: 'Variants',
    table: 'variants',
    columns: ['sp_no', 'parent_sp_no', 'variant_name', 'common_name', 'rating', 'variant_type', 'botanical_rank', 'is_hybrid', 'hybrid_parent_1', 'hybrid_parent_2', 'notes', 'species_origin', 'natural_habitat', 'species_notes'],
    types: {
      sp_no: 'number', parent_sp_no: 'number', variant_name: 'text', common_name: 'text',
      rating: 'text', variant_type: 'text', botanical_rank: 'text', is_hybrid: 'bool',
      hybrid_parent_1: 'text', hybrid_parent_2: 'text', notes: 'text',
      species_origin: 'text', natural_habitat: 'text', species_notes: 'text',
    },
  },
}

function coerce(raw: string, type: FieldType): any {
  const trimmed = (raw ?? '').trim()
  if (type === 'number') {
    if (trimmed === '') return null
    const n = Number(trimmed)
    return isNaN(n) ? null : n
  }
  if (type === 'bool') {
    const upper = trimmed.toUpperCase()
    if (upper === 'TRUE' || upper === '1') return true
    if (upper === 'FALSE' || upper === '0') return false
    return null
  }
  return trimmed === '' ? null : trimmed
}

function formatCell(v: any): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v)
}

export default function BulkEditPage() {
  const [activeTab, setActiveTab] = useState<string>('species')
  const [tsvText, setTsvText] = useState('')
  const [parsedRows, setParsedRows] = useState<any[]>([])
  const [existingMap, setExistingMap] = useState<Record<number, any>>({})
  const [parseError, setParseError] = useState('')
  const [checking, setChecking] = useState(false)
  const [applying, setApplying] = useState(false)
  const [skipBlanks, setSkipBlanks] = useState(true)
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  const config = TABLES[activeTab]

  function switchTab(tab: string) {
    setActiveTab(tab)
    setTsvText('')
    setParsedRows([])
    setExistingMap({})
    setParseError('')
    setResult('')
  }

  function copyHeaderTemplate() {
    navigator.clipboard.writeText(config.columns.join('\t'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handlePreview() {
    setParseError('')
    setResult('')
    const lines = tsvText.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim() !== '')
    if (lines.length === 0) {
      setParseError('Paste some TSV rows first.')
      return
    }

    const rows: any[] = []
    for (let i = 0; i < lines.length; i++) {
      const cells = lines[i].split('\t')
      if (cells.length !== config.columns.length) {
        setParseError(`Row ${i + 1} has ${cells.length} columns, expected ${config.columns.length}. Check for missing tabs or an extra column.`)
        return
      }
      const rowObj: any = {}
      config.columns.forEach((col, idx) => {
        rowObj[col] = coerce(cells[idx], config.types[col])
      })
      if (rowObj.sp_no === null) {
        setParseError(`Row ${i + 1} is missing a valid sp_no.`)
        return
      }
      rows.push(rowObj)
    }

    setChecking(true)
    const spNos = rows.map(r => r.sp_no)
    const { data, error } = await supabase
      .from(config.table)
      .select('*')
      .in('sp_no', spNos)
    setChecking(false)

    if (error) {
      setParseError('Error checking existing rows: ' + error.message)
      return
    }

    const map: Record<number, any> = {}
    ;(data || []).forEach((r: any) => { map[r.sp_no] = r })
    setExistingMap(map)
    setParsedRows(rows)
  }

  async function handleApply() {
    setApplying(true)
    setResult('')

    const upsertRows = parsedRows.map(row => {
      const existing = existingMap[row.sp_no]
      if (!existing) return row
      if (!skipBlanks) return row
      const merged: any = { sp_no: row.sp_no }
      config.columns.forEach(col => {
        if (col === 'sp_no') return
        merged[col] = row[col] !== null ? row[col] : existing[col]
      })
      return merged
    })

    const { error } = await supabase
      .from(config.table)
      .upsert(upsertRows, { onConflict: 'sp_no' })

    setApplying(false)

    if (error) {
      setResult('Error applying changes: ' + error.message)
      return
    }

    setResult(`Successfully applied ${upsertRows.length} row(s) to ${config.label}.`)
    setTsvText('')
    setParsedRows([])
    setExistingMap({})
  }

  const inputStyle = { width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box' as const }

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <a href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none', display: 'block', marginBottom: '8px' }}>&larr; Admin Home</a>
      <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 16px' }}>Bulk Edit</h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {Object.keys(TABLES).map(key => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '600',
              border: activeTab === key ? '1px solid #2563eb' : '1px solid #e2e8f0',
              background: activeTab === key ? '#2563eb' : '#fff',
              color: activeTab === key ? '#fff' : '#374151',
              cursor: 'pointer',
            }}
          >
            {TABLES[key].label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          Paste TSV — no header row, columns in this order:
        </span>
        <button
          onClick={copyHeaderTemplate}
          style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f9fafb', cursor: 'pointer', color: '#374151' }}
        >
          {copied ? 'Copied!' : 'Copy Header Template'}
        </button>
      </div>
      <p style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace', marginBottom: '8px', wordBreak: 'break-all' }}>
        {config.columns.join(' | ')}
      </p>

      <textarea
        value={tsvText}
        onChange={e => setTsvText(e.target.value)}
        placeholder="Paste TSV rows here..."
        rows={8}
        style={{ ...inputStyle, marginBottom: '12px' }}
      />

      {parseError && (
        <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{parseError}</p>
      )}

      <button
        onClick={handlePreview}
        disabled={checking}
        style={{ background: checking ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: checking ? 'not-allowed' : 'pointer', marginBottom: '16px' }}
      >
        {checking ? 'Checking...' : 'Preview Diff'}
      </button>

      {parsedRows.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '12px' }}>
            <input type="checkbox" checked={skipBlanks} onChange={e => setSkipBlanks(e.target.checked)} />
            Skip blank cells (don't overwrite existing data with empty values)
          </label>

          {parsedRows.map(row => {
            const existing = existingMap[row.sp_no]
            const isNew = !existing
            return (
              <div key={row.sp_no} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontWeight: '700', fontSize: '14px' }}>sp_no {row.sp_no}</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: isNew ? '#dcfce7' : '#fef3c7', color: isNew ? '#16a34a' : '#b45309' }}>
                    {isNew ? 'NEW' : 'UPDATE'}
                  </span>
                </div>
                {!isNew && (
                  <div style={{ fontSize: '12px' }}>
                    {config.columns.filter(col => col !== 'sp_no' && row[col] !== null && row[col] !== existing[col]).map(col => (
                      <div key={col} style={{ display: 'flex', gap: '8px', padding: '2px 0', borderTop: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#6b7280', minWidth: '140px' }}>{col}</span>
                        <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>{formatCell(existing[col])}</span>
                        <span style={{ color: '#16a34a' }}>&rarr; {formatCell(row[col])}</span>
                      </div>
                    ))}
                    {config.columns.filter(col => col !== 'sp_no' && row[col] !== null && row[col] !== existing[col]).length === 0 && (
                      <p style={{ color: '#9ca3af' }}>No changes to existing data.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <button
            onClick={handleApply}
            disabled={applying}
            style={{ width: '100%', background: applying ? '#86efac' : '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: '700', cursor: applying ? 'not-allowed' : 'pointer', marginTop: '8px' }}
          >
            {applying ? 'Applying...' : `Apply ${parsedRows.length} Row(s) to ${config.label}`}
          </button>
        </div>
      )}

      {result && (
        <p style={{ fontSize: '14px', color: result.startsWith('Error') ? '#dc2626' : '#16a34a', marginTop: '12px' }}>{result}</p>
      )}
    </main>
  )
}