import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { REPORT_SECTIONS, SPECIES_INFO_FIELDS, SUITABILITY_FIELDS, formatValue } from '@/lib/advancedReport';

// ---- Same 13-category topic config as /api/research-search - reused here so the booklet prep
// page can pull the full reference picture for a species in one call. Keep these two files in
// sync if the underlying schema changes; consider extracting to a shared lib/topics.ts later.
const TOPICS: { id: string; label: string; sources: { table: string; fields: string[] }[] }[] = [
  {
    id: 'pruning',
    label: 'Pruning',
    sources: [
      { table: 'pruning_protocols', fields: ['pruning_core_rules', 'structural_pruning_timing', 'structural_pruning_method', 'structural_pruning_limits', 'post_flowering_pruning_timing', 'post_flowering_pruning_method', 'maintenance_pruning_timing', 'maintenance_pruning_method', 'old_wood_management', 'seasonal_timing_seq', 'recommended_techniques', 'common_mistakes', 'apical_management_strategy', 'branch_selection_rules', 'light_penetration_strategy', 'refinement_method', 'notes', 'research_status', 'data_source', 'needs_verification'] },
      { table: 'care_guide', fields: ['pruning_refinement_protocols', 'pruning_season', 'research_status', 'data_source', 'needs_verification'] },
    ],
  },
  {
    id: 'wiring',
    label: 'Wiring',
    sources: [
      { table: 'bonsai_suitability', fields: ['wire_bend_tolerance', 'wire_bend_notes', 'needs_verification', 'data_source'] },
      { table: 'care_guide', fields: ['wiring', 'branch_direction_after_wiring', 'research_status', 'data_source', 'needs_verification'] },
    ],
  },
  {
    id: 'nebari_roots',
    label: 'Nebari & Roots',
    sources: [
      { table: 'nebari_root', fields: ['root_architecture_type', 'natural_nebari_form', 'root_depth_tendency', 'root_spread_behaviour', 'development_speed', 'years_to_initial_nebari', 'years_to_mature_nebari', 'climate_influence_seq', 'taproot_removal_tolerance', 'radial_root_pruning_response', 'root_reduction_tolerance', 'fine_root_production', 'root_rot_susceptibility', 'ground_layering_suitability', 'tourniquet_method_suitability', 'root_grafting_success_rate', 'nebari_fusion_potential', 'best_techniques_for_species', 'typical_nebari_faults', 'underlying_causes', 'corrective_strategies', 'preferred_pot_depth', 'preferred_pot_width', 'surface_substrate_preference', 'moisture_preference', 'heat_sensitivity_at_root_base', 'ultimate_nebari_quality_potential', 'expected_mature_nebari_form', 'maintenance_requirements', 'ageing_notes', 'notes_for_future_development', 'research_status', 'data_source', 'needs_verification'] },
      { table: 'bonsai_suitability', fields: ['root_tolerance_score', 'root_tolerance_notes'] },
    ],
  },
  {
    id: 'fertilising',
    label: 'Fertilising',
    sources: [
      { table: 'fertilisation', fields: ['p_tolerance', 'n_requirement', 'preferred_fertiliser_types', 'avoid_fertilisers', 'recommended_products', 'notes_schema', 'research_status', 'data_source', 'needs_verification'] },
      { table: 'care_guide', fields: ['fertilizing', 'best_fertiliser_australia', 'research_status', 'data_source', 'needs_verification'] },
    ],
  },
  {
    id: 'repotting',
    label: 'Repotting',
    sources: [
      { table: 'care_guide', fields: ['repotting_guide', 'repotting_season', 'repotting_freq_yrs', 'research_status', 'data_source', 'needs_verification'] },
    ],
  },
  {
    id: 'watering',
    label: 'Watering',
    sources: [
      { table: 'care_guide', fields: ['watering', 'watering_frequency', 'watering_summer_notes', 'watering_winter_notes', 'research_status', 'data_source', 'needs_verification'] },
    ],
  },
  {
    id: 'seasonal',
    label: 'Seasonal Maintenance',
    sources: [
      { table: 'seasonal_maintenance', fields: ['spring_maintenance_guide', 'summer_maintenance_guide', 'autumn_maintenance_guide', 'winter_maintenance_guide', 'general_maintenance_notes', 'spring_care', 'summer_care', 'autumn_care', 'winter_care', 'research_status', 'data_source', 'needs_verification'] },
    ],
  },
  {
    id: 'styling',
    label: 'Styling & Design',
    sources: [
      { table: 'care_guide', fields: ['style_options', 'styling_considerations', 'technical_training_styling', 'research_status', 'data_source', 'needs_verification'] },
      { table: 'pot_style_matching', fields: ['habitat_geology_type', 'recommended_pot_colour', 'recommended_pot_texture', 'recommended_pot_shape', 'recommended_pot_depth', 'glazed_or_unglazed', 'recommended_bonsai_style', 'style_notes', 'companion_plants', 'research_status', 'data_source', 'needs_verification'] },
    ],
  },
  {
    id: 'bark',
    label: 'Bark Character',
    sources: [
      { table: 'bark_character', fields: ['bark_texture_type', 'natural_bark_character', 'development_speed', 'years_to_corking_onset', 'years_to_mature_character', 'climate_influence_notes', 'best_techniques_for_species', 'typical_bark_faults', 'underlying_causes', 'corrective_strategies', 'ultimate_bark_quality_potential', 'expected_mature_bark_form', 'maintenance_requirements', 'ageing_notes', 'notes_for_future_development', 'research_status', 'data_source', 'needs_verification'] },
      { table: 'bonsai_suitability', fields: ['bark_character_score'] },
    ],
  },
  {
    id: 'taper',
    label: 'Taper & Movement',
    sources: [
      { table: 'taper_movement', fields: ['natural_taper_tendency', 'trunk_movement_potential', 'best_techniques_for_species', 'notes', 'research_status', 'data_source', 'needs_verification'] },
      { table: 'bonsai_suitability', fields: ['taper_movement_score'] },
    ],
  },
  {
    id: 'regional',
    label: 'Regional Suitability & Climate',
    sources: [
      { table: 'regional_suitability', fields: ['tropical_suitability', 'tropical_notes', 'tropical_risk', 'tropical_training_adjustments', 'tropical_soil_modifier', 'tropical_watering_modifier', 'subtropical_suitability', 'subtropical_notes', 'subtropical_risk', 'subtropical_training_adjustments', 'subtropical_soil_modifier', 'subtropical_watering_modifier', 'temperate_suitability', 'temperate_notes', 'temperate_risk', 'temperate_training_adjustments', 'temperate_soil_modifier', 'temperate_watering_modifier', 'cold_suitability', 'cold_notes', 'cold_risk', 'cold_training_adjustments', 'cold_soil_modifier', 'cold_watering_modifier', 'availability_australia', 'availability_notes', 'nursery_availability', 'wild_collection_status', 'research_status', 'data_source', 'needs_verification'] },
      { table: 'care_guide', fields: ['climate_zone', 'zone_code', 'frost_risk', 'min_temp_c', 'summer_sun_protection'] },
    ],
  },
  {
    id: 'placement',
    label: 'Placement',
    sources: [
      { table: 'placement_matrix', fields: ['exposure_full_sun', 'exposure_morning_sun', 'exposure_dappled_shade', 'exposure_full_shade', 'exposure_full_sun_windy', 'exposure_variable_e', 'exposure_variable_f', 'seq_notes', 'national_notes', 'research_status', 'data_source', 'needs_verification'] },
    ],
  },
  {
    id: 'toxicity',
    label: 'Toxicity & Safety',
    sources: [
      { table: 'toxicity', fields: ['toxicity_level', 'toxic_to_humans', 'toxic_to_pets', 'toxic_to_livestock', 'toxic_parts', 'toxic_principle', 'symptoms', 'severity_notes', 'first_aid_notes', 'research_status', 'data_source', 'needs_verification'] },
    ],
  },
  {
    id: 'pests',
    label: 'Pests & Diseases',
    sources: [
      { table: 'care_guide', fields: ['pests_and_diseases', 'research_status', 'data_source', 'needs_verification'] },
    ],
  },
  {
    id: 'tubestock',
    label: 'Tubestock Development',
    sources: [
      { table: 'tubestock_development', fields: ['establishment_period_weeks', 'survival_rate_notes', 'common_failures', 'tubestock_potting_mix', 'first_pot_size', 'potting_on_schedule', 'initial_potting_timing', 'watering_frequency', 'fertilising_regime', 'recommended_fertiliser', 'growth_rate_expected', 'first_pruning_timing', 'first_structure_timing', 'root_establishment_notes', 'nursery_to_training_pot', 'revegetation_planting_notes', 'establishment_in_ground', 'weed_competition_tolerance', 'irrigation_requirement', 'species_specific_notes', 'research_status', 'data_source', 'needs_verification'] },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced / Expert',
    sources: [
      { table: 'advanced_expert', fields: ['ph_target', 'acquisition_raw_material', 'aesthetics_exhibition_philosophy', 'advanced_structural_engineering', 'morphology_notes', 'cambial_notes', 'seasonal_physiology', 'energy_model', 'backbudding_notes', 'ramification_stages', 'root_notes', 'hormonal_model', 'needle_control', 'climate_notes', 'styling_biomechanics', 'development_years_1_3', 'development_years_4_6', 'development_years_7_8', 'development_years_9_10', 'repotting_season_notes', 'research_status', 'data_source', 'needs_verification'] },
    ],
  },
];

// ---- GET: three modes ----
// mode=list            -> all booklets with species names, for the dashboard/status tracker
// mode=reference&sp_no= -> full 13-category real-content pull for the left reference panel
// mode=get&sp_no=       -> the booklet draft itself (creates an empty draft row on first access)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode');

  if (mode === 'list') {
    const { data: booklets, error } = await supabaseServer
      .from('booklets')
      .select('id, sp_no, title, status, price, version, updated_at, published_at')
      .order('updated_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const spNos = (booklets ?? []).map((b) => b.sp_no);
    const { data: speciesRows } = spNos.length
      ? await supabaseServer.from('species').select('sp_no, species, common_name').in('sp_no', spNos)
      : { data: [] };
    const speciesMap = new Map((speciesRows ?? []).map((s) => [s.sp_no, s]));

    const enriched = (booklets ?? []).map((b) => ({
      ...b,
      species_name: speciesMap.get(b.sp_no)?.species ?? 'Unknown',
      common_name: speciesMap.get(b.sp_no)?.common_name ?? null,
    }));
    return NextResponse.json({ booklets: enriched });
  }

  if (mode === 'reference') {
    const spNo = Number(searchParams.get('sp_no'));
    if (!spNo) return NextResponse.json({ error: 'sp_no required' }, { status: 400 });

    const { data: speciesRow } = await supabaseServer
      .from('species')
      .select('sp_no, species, species_genus, common_name')
      .eq('sp_no', spNo)
      .maybeSingle();
    if (!speciesRow) return NextResponse.json({ error: 'species not found' }, { status: 404 });

    const categories = await Promise.all(
      TOPICS.map(async (topic) => {
        const sections = await Promise.all(
          topic.sources.map(async (source) => {
            const { data, error } = await supabaseServer
              .from(source.table)
              .select(source.fields.join(','))
              .eq('sp_no', spNo)
              .maybeSingle();
            return { table: source.table, data: error ? null : data };
          })
        );
        return { id: topic.id, label: topic.label, sections };
      })
    );

    return NextResponse.json({ species: speciesRow, categories });
  }

  // mode=report&sp_no= -> everything Part Two (Advanced Species Report) prints, already shaped into
  // sections of label/value rows. Only whitelisted fields from lib/advancedReport.ts are returned.
  if (mode === 'report') {
    const spNo = Number(searchParams.get('sp_no'));
    if (!spNo) return NextResponse.json({ error: 'sp_no required' }, { status: 400 });

    const { data: speciesRow } = await supabaseServer
      .from('species')
      .select(SPECIES_INFO_FIELDS)
      .eq('sp_no', spNo)
      .maybeSingle<Record<string, unknown>>();
    if (!speciesRow) return NextResponse.json({ error: 'species not found' }, { status: 404 });

    const { data: suit } = await supabaseServer
      .from('bonsai_suitability')
      .select(SUITABILITY_FIELDS)
      .eq('sp_no', spNo)
      .maybeSingle<Record<string, unknown>>();

    const speciesInfo = [
      { label: 'Research Status', value: formatValue(speciesRow.research_status) },
      { label: 'Genus', value: formatValue(speciesRow.species_genus) },
      { label: 'Family', value: formatValue(speciesRow.species_family) },
      {
        label: 'Pure Species / AU Native',
        value: `${formatValue(speciesRow.pure_species) ?? '—'} / ${formatValue(speciesRow.australian_native) ?? '—'}`,
      },
      { label: 'Origin', value: formatValue(speciesRow.species_origin) },
      { label: 'Natural Habitat', value: formatValue(speciesRow.natural_habitat) },
      { label: 'Species Notes', value: formatValue(speciesRow.species_notes) },
    ].filter((r) => r.value);

    const suitability: { label: string; value: string | null }[] = [];
    if (suit) {
      const score = formatValue(suit.final_bonsai_score);
      if (score) {
        suitability.push({
          label: 'Suitability (Final Score)',
          value: `${score} / 100${formatValue(suit.bonsai_tier) ? ` — Tier: ${formatValue(suit.bonsai_tier)}` : ''}`,
        });
      }
      const diff = formatValue(suit.difficulty);
      if (diff) suitability.push({ label: 'Difficulty', value: `${diff} (0 = Hardest, 100 = Easiest)` });
      suitability.push({ label: 'Recommended Styles', value: formatValue(suit.recommended_bonsai_styles) });
      const scored: [string, string, string | null][] = [
        ['Vigor', 'vigor', 'vigor_notes'],
        ['Back Budding', 'back_budding_ability', 'back_budding_notes'],
        ['Ramification', 'ramification_potential', 'ramification_notes'],
        ['Leaf Reduction', 'leaf_reduction_potential', 'leaf_reduction_notes'],
        ['Root Tolerance', 'root_tolerance_score', 'root_tolerance_notes'],
        ['Wire/Bend Tolerance', 'wire_bend_tolerance', 'wire_bend_notes'],
        ['Nebari Potential', 'nebari_potential_score', null],
        ['Bark Character', 'bark_character_score', null],
        ['Taper & Movement', 'taper_movement_score', null],
      ];
      for (const [label, scoreField, notesField] of scored) {
        const s = formatValue(suit[scoreField]);
        if (!s) continue;
        const notes = notesField ? formatValue(suit[notesField]) : null;
        suitability.push({
          label: `${label} — ${s}`,
          value: notes ?? `See ${label === 'Nebari Potential' ? 'Nebari & Root' : label} section below.`,
        });
      }
      const longevity = formatValue(suit.longevity_score);
      const nativeBonus = formatValue(suit.native_bonus);
      if (longevity || nativeBonus) {
        suitability.push({
          label: [longevity ? `Longevity — ${longevity}` : null, nativeBonus ? `Native Bonus — ${nativeBonus}` : null]
            .filter(Boolean)
            .join(' · '),
          value: 'All ratings expressed on a 1–100 scale.',
        });
      }
    }

    const sections = await Promise.all(
      REPORT_SECTIONS.map(async (sec) => {
        const { data, error } = await supabaseServer
          .from(sec.table)
          .select(sec.rows.map((r) => r.field).join(','))
          .eq('sp_no', spNo)
          .maybeSingle<Record<string, unknown>>();
        const rows = error || !data
          ? []
          : sec.rows
              .map((r) => ({ label: r.label, value: formatValue(data[r.field]) }))
              .filter((r) => r.value);
        return { id: sec.id, title: sec.title, rows };
      })
    );

    return NextResponse.json({
      species: { sp_no: spNo, name: speciesRow.species, common_name: speciesRow.common_name },
      sections: [
        { id: 'species_info', title: 'Species Info', rows: speciesInfo },
        { id: 'suitability', title: 'Bonsai Suitability Profile', rows: suitability.filter((r) => r.value) },
        ...sections,
      ].filter((s) => s.rows.length > 0),
    });
  }

  if (mode === 'get') {
    const spNo = Number(searchParams.get('sp_no'));
    if (!spNo) return NextResponse.json({ error: 'sp_no required' }, { status: 400 });

    const { data: existing } = await supabaseServer.from('booklets').select('*').eq('sp_no', spNo).maybeSingle();
    if (existing) return NextResponse.json({ booklet: existing });

    // No draft yet for this species - create an empty one so the editor always has a row to save against
    const { data: speciesRow } = await supabaseServer.from('species').select('species').eq('sp_no', spNo).maybeSingle();
    const { data: created, error } = await supabaseServer
      .from('booklets')
      .insert({ sp_no: spNo, title: speciesRow?.species ?? null, status: 'draft', content: '' })
      .select('*')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ booklet: created });
  }

  return NextResponse.json({ error: 'unknown mode' }, { status: 400 });
}

// ---- PATCH: save draft content, title, price, or status ----
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  if (fields.status === 'published' && !fields.published_at) {
    fields.published_at = new Date().toISOString();
  }

  const { data, error } = await supabaseServer.from('booklets').update(fields).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ booklet: data });
}
