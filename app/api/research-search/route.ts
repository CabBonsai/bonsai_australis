import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

// ---- Micro-issue topic config: each topic maps to the table(s)/field(s) that hold it ----
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode');

  // ---- mode=topics: static list for the third dropdown ----
  if (mode === 'topics') {
    return NextResponse.json({ topics: TOPICS.map((t) => ({ id: t.id, label: t.label })) });
  }

  // ---- mode=species: typeahead search for the first dropdown ----
  if (mode === 'species') {
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 2) return NextResponse.json({ results: [] });
    const { data, error } = await supabaseServer
      .from('species')
      .select('sp_no, species, species_genus, common_name')
      .or(`species.ilike.%${q}%,common_name.ilike.%${q}%`)
      .order('species')
      .limit(25);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ results: data });
  }

  // ---- mode=variants: populate the second dropdown once a species is picked ----
  if (mode === 'variants') {
    const parentSpNo = Number(searchParams.get('sp_no'));
    if (!parentSpNo) return NextResponse.json({ error: 'sp_no required' }, { status: 400 });
    const { data, error } = await supabaseServer
      .from('variants')
      .select('sp_no, variant_name, common_name, botanical_rank, is_deprecated')
      .eq('parent_sp_no', parentSpNo)
      .order('variant_name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ results: data });
  }

  // ---- mode=content: the actual search - fetch the chosen topic's fields for the chosen sp_no ----
  if (mode === 'content') {
    const spNo = Number(searchParams.get('sp_no'));
    const topicId = searchParams.get('topic');
    if (!spNo || !topicId) return NextResponse.json({ error: 'sp_no and topic required' }, { status: 400 });
    const topic = TOPICS.find((t) => t.id === topicId);
    if (!topic) return NextResponse.json({ error: 'unknown topic' }, { status: 400 });

    // A given sp_no belongs to either species or variants (variants have their own sp_no per BAMSR v3.1.1 - no delta scoring)
    const [{ data: speciesRow }, { data: variantRow }] = await Promise.all([
      supabaseServer.from('species').select('sp_no, species, species_genus, common_name, research_status').eq('sp_no', spNo).maybeSingle(),
      supabaseServer.from('variants').select('sp_no, variant_name, common_name, parent_sp_no, botanical_rank').eq('sp_no', spNo).maybeSingle(),
    ]);

    let subject: Record<string, unknown> | null = null;
    if (speciesRow) {
      subject = { kind: 'species', name: speciesRow.species, genus: speciesRow.species_genus, common_name: speciesRow.common_name, research_status: speciesRow.research_status };
    } else if (variantRow) {
      const { data: parentSpecies } = await supabaseServer.from('species').select('species').eq('sp_no', variantRow.parent_sp_no).maybeSingle();
      subject = { kind: 'variant', name: `${parentSpecies?.species ?? 'Unknown parent'} '${variantRow.variant_name}'`, common_name: variantRow.common_name, botanical_rank: variantRow.botanical_rank };
    } else {
      return NextResponse.json({ error: 'sp_no not found in species or variants' }, { status: 404 });
    }

    // Fetch every source table this topic maps to
    const sections = await Promise.all(
      topic.sources.map(async (source) => {
        const { data, error } = await supabaseServer
          .from(source.table)
          .select(source.fields.join(','))
          .eq('sp_no', spNo)
          .maybeSingle();
        return { table: source.table, data: error ? null : data, error: error?.message ?? null };
      })
    );

    // If this is a variant, also surface the override-resolved effective-care view
    // (covers watering/repotting/fertilising/winter-care overlap with variant_overrides)
    let effectiveCare = null;
    if (variantRow) {
      const { data } = await supabaseServer.from('variant_effective_care').select('*').eq('sp_no', spNo).maybeSingle();
      effectiveCare = data ?? null;
    }

    return NextResponse.json({ subject, topic: { id: topic.id, label: topic.label }, sections, effectiveCare });
  }

  return NextResponse.json({ error: 'unknown mode' }, { status: 400 });
}
