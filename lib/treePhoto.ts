// Any tree recorded as dead/deceased shows the RIP photo instead of its own
// photo, everywhere a tree thumbnail or hero is shown. The tree's real photo
// stays in the database untouched; this only changes what is displayed.
export const RIP_PHOTO = '/rip.jpg'

type TreeLike = {
  status?: string | null
  health_status?: string | null
  location?: string | null
}

export function isDeceased(t: TreeLike | null | undefined): boolean {
  if (!t) return false
  const dead = (v?: string | null) => {
    const s = (v || '').trim().toLowerCase()
    return s === 'dead' || s === 'deceased'
  }
  return dead(t.status) || dead(t.health_status) || dead(t.location)
}

// Returns the photo URL to display (RIP photo for deceased trees).
export function displayPhoto(t: TreeLike | null | undefined, url: string | null | undefined): string | null {
  if (isDeceased(t)) return RIP_PHOTO
  return url || null
}
