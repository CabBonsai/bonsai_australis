// Part Two of a booklet chapter: the "Advanced Species Report".
//
// Layout follows chapter-01-queensland-bottle-tree-REFERENCE.pdf: one banded header per section,
// then two-column label/value rows. This file is the reader-facing WHITELIST - only fields listed
// here are ever printed. Internal fields (research_notes, data_source, needs_verification,
// reference_urls, last_updated, *_status) are deliberately never included.
//
// To add or reorder a field, edit the rows below. Labels are what the reader sees.

export type ReportRow = { label: string; field: string };
export type ReportSection = {
  id: string;
  title: string;
  table: string;
  rows: ReportRow[];
};

export const REPORT_SECTIONS: ReportSection[] = [
  {
    id: 'care_guide',
    title: 'Care Guide',
    table: 'care_guide',
    rows: [
      { label: 'Growth Season', field: 'growth_season' },
      { label: 'Growth Season Notes', field: 'growth_season_notes' },
      { label: 'Growth Plan', field: 'growth_plan' },
      { label: 'Watering', field: 'watering' },
      { label: 'Watering (Summer)', field: 'watering_summer_notes' },
      { label: 'Watering (Winter)', field: 'watering_winter_notes' },
      { label: 'Sun / Light', field: 'sun_exposure' },
      { label: 'Light Requirements', field: 'light_requirements' },
      { label: 'Fertilising', field: 'fertilizing' },
      { label: 'Best Fertiliser (AU)', field: 'best_fertiliser_australia' },
      { label: 'Promote Back Budding', field: 'promote_back_budding' },
      { label: 'Style Options', field: 'style_options' },
      { label: 'Styling Considerations', field: 'styling_considerations' },
      { label: 'Wiring', field: 'wiring' },
      { label: 'Repotting', field: 'repotting_guide' },
      { label: 'Best Soil Mix', field: 'best_soil_mix' },
      { label: 'Pests & Diseases', field: 'pests_and_diseases' },
      { label: 'Climate Zone', field: 'climate_zone' },
      { label: 'Frost Risk', field: 'frost_risk' },
      { label: 'Min Temp (°C)', field: 'min_temp_c' },
      { label: 'Summer Sun Protection', field: 'summer_sun_protection' },
      { label: 'Pruning Season', field: 'pruning_season' },
      { label: 'Repotting Season', field: 'repotting_season' },
      { label: 'Repotting Frequency (yrs)', field: 'repotting_freq_yrs' },
    ],
  },
  {
    id: 'toxicity',
    title: 'Toxicity',
    table: 'toxicity',
    rows: [
      { label: 'Toxicity Level', field: 'toxicity_level' },
      { label: 'Toxic to Humans', field: 'toxic_to_humans' },
      { label: 'Toxic to Pets', field: 'toxic_to_pets' },
      { label: 'Toxic to Livestock', field: 'toxic_to_livestock' },
      { label: 'Toxic Parts', field: 'toxic_parts' },
      { label: 'Symptoms', field: 'symptoms' },
      { label: 'Severity Notes', field: 'severity_notes' },
      { label: 'First Aid Notes', field: 'first_aid_notes' },
    ],
  },
  {
    id: 'fertilisation',
    title: 'Fertilisation',
    table: 'fertilisation',
    rows: [
      { label: 'P Tolerance', field: 'p_tolerance' },
      { label: 'N Requirement', field: 'n_requirement' },
      { label: 'Preferred Types', field: 'preferred_fertiliser_types' },
      { label: 'Avoid', field: 'avoid_fertilisers' },
      { label: 'Recommended Products', field: 'recommended_products' },
    ],
  },
  {
    id: 'pruning',
    title: 'Pruning Protocols',
    table: 'pruning_protocols',
    rows: [
      { label: 'Core Rules', field: 'pruning_core_rules' },
      { label: 'Structural Timing', field: 'structural_pruning_timing' },
      { label: 'Structural Method', field: 'structural_pruning_method' },
      { label: 'Structural Limits', field: 'structural_pruning_limits' },
      { label: 'Maintenance Timing', field: 'maintenance_pruning_timing' },
      { label: 'Maintenance Method', field: 'maintenance_pruning_method' },
      { label: 'Old Wood Management', field: 'old_wood_management' },
      { label: 'Seasonal Timing', field: 'seasonal_timing_seq' },
      { label: 'Recommended Techniques', field: 'recommended_techniques' },
      { label: 'Common Mistakes', field: 'common_mistakes' },
      { label: 'Apical Management', field: 'apical_management_strategy' },
      { label: 'Branch Selection', field: 'branch_selection_rules' },
      { label: 'Light Penetration', field: 'light_penetration_strategy' },
      { label: 'Refinement Method', field: 'refinement_method' },
    ],
  },
  {
    id: 'nebari',
    title: 'Nebari & Root',
    table: 'nebari_root',
    rows: [
      { label: 'Root Architecture', field: 'root_architecture_type' },
      { label: 'Natural Nebari Form', field: 'natural_nebari_form' },
      { label: 'Years to Initial Nebari', field: 'years_to_initial_nebari' },
      { label: 'Years to Mature Nebari', field: 'years_to_mature_nebari' },
      { label: 'Taproot Removal Tolerance', field: 'taproot_removal_tolerance' },
      { label: 'Root Reduction Tolerance', field: 'root_reduction_tolerance' },
      { label: 'Best Techniques', field: 'best_techniques_for_species' },
      { label: 'Typical Faults', field: 'typical_nebari_faults' },
      { label: 'Corrective Strategies', field: 'corrective_strategies' },
      { label: 'Preferred Pot Depth', field: 'preferred_pot_depth' },
      { label: 'Preferred Pot Width', field: 'preferred_pot_width' },
      { label: 'Surface Substrate', field: 'surface_substrate_preference' },
      { label: 'Maintenance', field: 'maintenance_requirements' },
      { label: 'Ageing Notes', field: 'ageing_notes' },
    ],
  },
  {
    id: 'seasonal',
    title: 'Seasonal Maintenance',
    table: 'seasonal_maintenance',
    rows: [
      { label: 'Spring', field: 'spring_maintenance_guide' },
      { label: 'Summer', field: 'summer_maintenance_guide' },
      { label: 'Autumn', field: 'autumn_maintenance_guide' },
      { label: 'Winter', field: 'winter_maintenance_guide' },
      { label: 'General Notes', field: 'general_maintenance_notes' },
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced & Expert',
    table: 'advanced_expert',
    rows: [
      { label: 'pH Target', field: 'ph_target' },
      { label: 'Back Budding', field: 'backbudding_notes' },
      { label: 'Ramification Stages', field: 'ramification_stages' },
      { label: 'Root Notes', field: 'root_notes' },
      { label: 'Needle Control', field: 'needle_control' },
      { label: 'Climate Notes', field: 'climate_notes' },
      { label: 'Repotting Season Notes', field: 'repotting_season_notes' },
      { label: 'Styling Biomechanics', field: 'styling_biomechanics' },
      { label: 'Morphology', field: 'morphology_notes' },
      { label: 'Seasonal Physiology', field: 'seasonal_physiology' },
      { label: 'Acquiring Material', field: 'acquisition_raw_material' },
      { label: 'Aesthetics & Exhibition', field: 'aesthetics_exhibition_philosophy' },
      { label: 'Structural Engineering', field: 'advanced_structural_engineering' },
      { label: 'Development Years 1–3', field: 'development_years_1_3' },
      { label: 'Development Years 4–6', field: 'development_years_4_6' },
      { label: 'Development Years 7–8', field: 'development_years_7_8' },
      { label: 'Development Years 9–10', field: 'development_years_9_10' },
    ],
  },
  {
    id: 'regional',
    title: 'Regional Suitability',
    table: 'regional_suitability',
    rows: [
      { label: 'Tropical', field: 'tropical_suitability' },
      { label: 'Tropical Notes', field: 'tropical_notes' },
      { label: 'Subtropical', field: 'subtropical_suitability' },
      { label: 'Subtropical Notes', field: 'subtropical_notes' },
      { label: 'Temperate', field: 'temperate_suitability' },
      { label: 'Temperate Notes', field: 'temperate_notes' },
      { label: 'Cold', field: 'cold_suitability' },
      { label: 'Cold Notes', field: 'cold_notes' },
      { label: 'Cold Risk', field: 'cold_risk' },
      { label: 'Availability (Australia)', field: 'availability_australia' },
      { label: 'Nursery Availability', field: 'nursery_availability' },
      { label: 'Wild Collection Status', field: 'wild_collection_status' },
    ],
  },
  {
    id: 'placement',
    title: 'Placement Matrix',
    table: 'placement_matrix',
    rows: [
      { label: 'Full Sun (A)', field: 'exposure_full_sun' },
      { label: 'Morning Sun (B)', field: 'exposure_morning_sun' },
      { label: 'Dappled Shade (C)', field: 'exposure_dappled_shade' },
      { label: 'Full Sun, Windy (D)', field: 'exposure_full_sun_windy' },
      { label: 'Variable, Cold Drainage (E)', field: 'exposure_variable_e' },
      { label: 'Variable, Sheltered (F)', field: 'exposure_variable_f' },
      { label: 'Full Shade (G)', field: 'exposure_full_shade' },
      { label: 'SEQ Notes', field: 'seq_notes' },
      { label: 'National Notes', field: 'national_notes' },
    ],
  },
  {
    id: 'bark',
    title: 'Bark Character',
    table: 'bark_character',
    rows: [
      { label: 'Bark Texture', field: 'bark_texture_type' },
      { label: 'Natural Character', field: 'natural_bark_character' },
      { label: 'Development Speed', field: 'development_speed' },
      { label: 'Best Techniques', field: 'best_techniques_for_species' },
      { label: 'Typical Faults', field: 'typical_bark_faults' },
      { label: 'Ultimate Quality', field: 'ultimate_bark_quality_potential' },
      { label: 'Expected Mature Form', field: 'expected_mature_bark_form' },
      { label: 'Maintenance', field: 'maintenance_requirements' },
      { label: 'Ageing Notes', field: 'ageing_notes' },
    ],
  },
  {
    id: 'propagation',
    title: 'Propagation',
    table: 'propagation',
    rows: [
      { label: 'Seed Availability', field: 'seed_availability' },
      { label: 'Seed Collection Timing', field: 'seed_collection_timing' },
      { label: 'Seed Pretreatment', field: 'seed_pretreatment_required' },
      { label: 'Germination Method', field: 'germination_method' },
      { label: 'Germination Timeframe', field: 'germination_timeframe' },
      { label: 'Cutting Viability', field: 'cutting_viability' },
      { label: 'Cutting Method', field: 'cutting_method' },
      { label: 'Other Methods', field: 'other_propagation_methods' },
      { label: 'Post-Germination Care', field: 'post_germination_care' },
      { label: 'Difficulty Notes', field: 'propagation_difficulty_notes' },
    ],
  },
  {
    id: 'taper',
    title: 'Taper & Movement',
    table: 'taper_movement',
    rows: [
      { label: 'Natural Taper', field: 'natural_taper_tendency' },
      { label: 'Trunk Movement', field: 'trunk_movement_potential' },
      { label: 'Best Techniques', field: 'best_techniques_for_species' },
      { label: 'Notes', field: 'notes' },
    ],
  },
  {
    id: 'pot_style',
    title: 'Pot & Style Matching',
    table: 'pot_style_matching',
    rows: [
      { label: 'Habitat / Geology', field: 'habitat_geology_type' },
      { label: 'Pot Colour', field: 'recommended_pot_colour' },
      { label: 'Pot Texture', field: 'recommended_pot_texture' },
      { label: 'Pot Shape', field: 'recommended_pot_shape' },
      { label: 'Pot Depth', field: 'recommended_pot_depth' },
      { label: 'Glazed or Unglazed', field: 'glazed_or_unglazed' },
      { label: 'Recommended Style', field: 'recommended_bonsai_style' },
      { label: 'Style Notes', field: 'style_notes' },
      { label: 'Companion Plants', field: 'companion_plants' },
    ],
  },
];

// Fields pulled for the two special sections built in code (Species Info, Bonsai Suitability Profile).
export const SPECIES_INFO_FIELDS =
  'sp_no, species, species_genus, species_family, common_name, tree_type, pure_species, australian_native, species_origin, natural_habitat, species_notes, research_status';

export const SUITABILITY_FIELDS =
  'final_bonsai_score, bonsai_tier, difficulty, recommended_bonsai_styles, vigor, vigor_notes, back_budding_ability, back_budding_notes, ramification_potential, ramification_notes, leaf_reduction_potential, leaf_reduction_notes, root_tolerance_score, root_tolerance_notes, wire_bend_tolerance, wire_bend_notes, nebari_potential_score, bark_character_score, taper_movement_score, longevity_score, native_bonus';

// Wording that belongs to the project's working notes, not to a reader. The Studio highlights any
// cell that matches so it can be reworded before the chapter is published. Nothing is removed
// automatically - the database text is the source of truth.
export const INTERNAL_WORDING = /\b(session\s*\d+|REVISED|CORRECTED|owner'?s standard|Family Default|genus-inferred|research_notes|sp_no|\w+_\w+\.\w+|\w+\.\w+_\w+)\b|\b[a-z]+(?:_[a-z]+){1,}\b/i;

export function formatValue(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v).trim();
  if (s === '' || s === '— not set —') return null;
  return s;
}
