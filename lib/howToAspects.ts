// How-To Sheet: the care aspects a sheet can cover, and which database fields feed each one.
//
// Pure data (no server imports) so the species page can list the aspects and the PDF route can
// build the sheet from the same config. Labels are what the reader sees. Only fields listed here
// are ever printed; internal fields (research_notes, data_source, needs_verification,
// reference_urls, *_status) are never included.
//
// To add an aspect or a field, edit the config below; nothing else needs to change.

export type AspectRow = { label: string; field: string };
export type AspectSource = { table: string; rows: AspectRow[] };
export type Aspect = { id: string; title: string; sources: AspectSource[] };

export const ASPECTS: Aspect[] = [
  {
    id: 'pruning',
    title: 'Pruning',
    sources: [
      {
        table: 'pruning_protocols',
        rows: [
          { label: 'Core rules', field: 'pruning_core_rules' },
          { label: 'Structural pruning: timing', field: 'structural_pruning_timing' },
          { label: 'Structural pruning: method', field: 'structural_pruning_method' },
          { label: 'Structural pruning: limits', field: 'structural_pruning_limits' },
          { label: 'Maintenance pruning: timing', field: 'maintenance_pruning_timing' },
          { label: 'Maintenance pruning: method', field: 'maintenance_pruning_method' },
          { label: 'Post-flowering pruning: timing', field: 'post_flowering_pruning_timing' },
          { label: 'Post-flowering pruning: method', field: 'post_flowering_pruning_method' },
          { label: 'Branch selection', field: 'branch_selection_rules' },
          { label: 'Apical management', field: 'apical_management_strategy' },
          { label: 'Light penetration', field: 'light_penetration_strategy' },
          { label: 'Old wood', field: 'old_wood_management' },
          { label: 'Recommended techniques', field: 'recommended_techniques' },
          { label: 'Refinement', field: 'refinement_method' },
          { label: 'Seasonal sequence', field: 'seasonal_timing_seq' },
          { label: 'Common mistakes', field: 'common_mistakes' },
        ],
      },
      { table: 'care_guide', rows: [{ label: 'Pruning season', field: 'pruning_season' }] },
    ],
  },
  {
    id: 'wiring',
    title: 'Wiring and Training',
    sources: [
      {
        table: 'care_guide',
        rows: [
          { label: 'Wiring', field: 'wiring' },
          { label: 'Branch direction after wiring', field: 'branch_direction_after_wiring' },
          { label: 'Technical training', field: 'technical_training_styling' },
          { label: 'Promoting back budding', field: 'promote_back_budding' },
        ],
      },
    ],
  },
  {
    id: 'repotting',
    title: 'Repotting and Soil',
    sources: [
      {
        table: 'care_guide',
        rows: [
          { label: 'Repotting', field: 'repotting_guide' },
          { label: 'Repotting season', field: 'repotting_season' },
          { label: 'Repotting frequency (years)', field: 'repotting_freq_yrs' },
          { label: 'Soil mix', field: 'best_soil_mix' },
        ],
      },
    ],
  },
  {
    id: 'fertilising',
    title: 'Fertilising',
    sources: [
      {
        table: 'fertilisation',
        rows: [
          { label: 'Recommended products', field: 'recommended_products' },
          { label: 'Preferred types', field: 'preferred_fertiliser_types' },
          { label: 'Avoid', field: 'avoid_fertilisers' },
          { label: 'Nitrogen requirement', field: 'n_requirement' },
          { label: 'Phosphorus tolerance', field: 'p_tolerance' },
          { label: 'Notes', field: 'notes_schema' },
        ],
      },
      {
        table: 'care_guide',
        rows: [
          { label: 'Fertilising', field: 'fertilizing' },
          { label: 'Best fertiliser (Australia)', field: 'best_fertiliser_australia' },
        ],
      },
    ],
  },
  {
    id: 'watering',
    title: 'Watering',
    sources: [
      {
        table: 'care_guide',
        rows: [
          { label: 'Watering', field: 'watering' },
          { label: 'Frequency', field: 'watering_frequency' },
          { label: 'Summer', field: 'watering_summer_notes' },
          { label: 'Winter', field: 'watering_winter_notes' },
        ],
      },
    ],
  },
  {
    id: 'seasonal',
    title: 'Seasonal Care',
    sources: [
      {
        table: 'seasonal_maintenance',
        rows: [
          { label: 'Spring', field: 'spring_maintenance_guide' },
          { label: 'Summer', field: 'summer_maintenance_guide' },
          { label: 'Autumn', field: 'autumn_maintenance_guide' },
          { label: 'Winter', field: 'winter_maintenance_guide' },
          { label: 'General notes', field: 'general_maintenance_notes' },
        ],
      },
    ],
  },
  {
    id: 'styling',
    title: 'Styling and Pots',
    sources: [
      {
        table: 'care_guide',
        rows: [
          { label: 'Style options', field: 'style_options' },
          { label: 'Styling considerations', field: 'styling_considerations' },
        ],
      },
      {
        table: 'pot_style_matching',
        rows: [
          { label: 'Recommended style', field: 'recommended_bonsai_style' },
          { label: 'Pot colour', field: 'recommended_pot_colour' },
          { label: 'Pot texture', field: 'recommended_pot_texture' },
          { label: 'Pot shape', field: 'recommended_pot_shape' },
          { label: 'Pot depth', field: 'recommended_pot_depth' },
          { label: 'Glazed or unglazed', field: 'glazed_or_unglazed' },
          { label: 'Style notes', field: 'style_notes' },
          { label: 'Companion plants', field: 'companion_plants' },
        ],
      },
    ],
  },
  {
    id: 'climate',
    title: 'Climate and Position',
    sources: [
      {
        table: 'care_guide',
        rows: [
          { label: 'Sun', field: 'sun_exposure' },
          { label: 'Light', field: 'light_requirements' },
          { label: 'Summer sun protection', field: 'summer_sun_protection' },
          { label: 'Frost', field: 'frost_risk' },
          { label: 'Minimum temperature (C)', field: 'min_temp_c' },
          { label: 'Climate zone', field: 'climate_zone' },
          { label: 'Pests and diseases', field: 'pests_and_diseases' },
        ],
      },
      {
        table: 'regional_suitability',
        rows: [
          { label: 'Subtropical climates', field: 'subtropical_notes' },
          { label: 'Temperate climates', field: 'temperate_notes' },
          { label: 'Cold climates', field: 'cold_notes' },
        ],
      },
    ],
  },
];

export const ASPECT_IDS = ASPECTS.map((a) => a.id);
