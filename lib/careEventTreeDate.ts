// When a care task is marked done, the tree's matching "last done" date should
// move too, otherwise the schedule says done while the tree record is stale.
// Repot and prune have a matching field on the collection table; wire checks,
// recovery and "other" just close in care_schedule (their completed_date and
// notes stay in the task history).
//
// Fertilise is deliberately NOT here: recording a feed needs the product, the
// next scheduled feed and any matching reminder, which the Fertiliser Walk does
// together. A fertilise task's Done button opens the walk for that tree instead.

export const TREE_DATE_FIELD_FOR_EVENT: Record<string, string> = {
  repot: 'last_repotted',
  prune: 'last_pruned',
}

export const TREE_DATE_LABEL: Record<string, string> = {
  last_repotted: 'Last Repotted',
  last_pruned: 'Last Pruned',
}

// Fertiliser Walk opened on a single tree. `back` is the in-app page to offer a
// Back button to (for example '/overdue'); the walk only accepts paths on this site.
export function fertiliserWalkUrl(treeNumber: number | string, back?: string): string {
  const base = `/fertiliser-walk?tree=${encodeURIComponent(String(treeNumber))}`
  return back ? `${base}&back=${encodeURIComponent(back)}` : base
}

// Sets the tree's last-done field. Throws on failure so the caller can leave
// the task open instead of half-saving.
export async function setTreeLastDone(collectionId: string | number, field: string, date: string): Promise<void> {
  const res = await fetch('/api/collection', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection_id: collectionId, [field]: date }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(`Could not update the tree: ${data?.error || res.statusText}`)
  }
}
