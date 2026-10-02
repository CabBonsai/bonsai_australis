// lib/wateringZones.ts
//
// Single source of truth for watering zones.
//
// The collection.watering_zone column stores the descriptive name (for example
// 'Moderate-High'). The letter (Zone A-H) is a display convention only: it is
// worked out from the position of the name in ZONES below (A = first, B = second,
// and so on), so re-ordering ZONES re-letters every page that uses this file.
//
// Used by: the Watering Zones page, the collection list, and the tree detail page.
// The /api/watering-zones route keeps its own list of valid names for validation.

export const ZONES = [
  'Permanent Water Tray',
  'Frequent/Daily Watering',
  'Moderate-High',
  'Standard/Moderate',
  'Moderate-Drought',
  'Low-Moderate',
  'Low Water/Drought-Tolerant',
  'Isolate - Overwater/Rot Risk',
] as const

export const ZONE_CODES: Record<string, string> = Object.fromEntries(
  ZONES.map((zone, i) => [zone, String.fromCharCode(65 + i)]) // A, B, C, ...
)

export const ZONE_DESCRIPTIONS: Record<string, string> = {
  'Permanent Water Tray': 'Confirmed to tolerate sitting in a permanent water tray.',
  'Frequent/Daily Watering': 'Declines quickly if allowed to dry out — not confirmed tray-safe.',
  'Moderate-High': 'Regular rhythm, leaning toward more frequent.',
  'Standard/Moderate': 'Normal bonsai watering rhythm.',
  'Moderate-Drought': 'Regular rhythm, leaning toward more drying between waterings.',
  'Low-Moderate': 'Tolerant of some drying.',
  'Low Water/Drought-Tolerant': 'Risk here is overwatering, not underwatering.',
  'Isolate - Overwater/Rot Risk': 'Real, sourced overwatering/root-rot failure mode — keep physically separate.',
}

// Letter for a stored zone name, or null when the tree has no zone (or an unknown one).
export function zoneLetter(zone: string | null | undefined): string | null {
  if (!zone) return null
  return ZONE_CODES[zone] ?? null
}
