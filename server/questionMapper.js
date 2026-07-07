const QUESTION_ID_MAP = {
  // Test ID 1: Caffeine
  1: {
    1: ["cyp1a2_duration_effect", "cyp1a2_time_of_day_tolerance", "cyp1a2_dose_threshold", "cyp1a2_multicup_carryover", "cyp1a2_daily_capacity"],
    2: ["adora2a_sleep_impact", "adora2a_physical_jitter", "adora2a_small_dose", "adora2a_alertness_intensity", "adora2a_sleep_depth"]
  },
  // Test ID 2: Muscle
  2: {
    1: ["actn3_power_explosive", "actn3_preference", "actn3_recovery_speed", "actn3_strength_gain", "actn3_maximal_effort"],
    2: ["ace_endurance_capacity", "ace_training_adaptation", "ace_fatigue_resistance", "ace_cardio_recovery", "ace_daily_stamina"]
  },
  // Test ID 3: Hair
  3: {
    1: ["edar_hair_texture_shape", "edar_scalp_oiliness", "edar_sweating_tendency", "edar_follicle_density", "edar_hair_coarseness"],
    2: ["fgfr2_hair_thickness", "fgfr2_trait_stability", "fgfr2_strand_diameter", "fgfr2_growth_rate", "fgfr2_breakage_resistance"]
  }
};
module.exports = { QUESTION_ID_MAP };
