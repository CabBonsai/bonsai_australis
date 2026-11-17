// Browser-side reads of `collection` go through the admin server route
// (the table no longer has an anon SELECT policy).
export async function readCollection(opts: Record<string, string> = {}): Promise<{ data: any[]; error: { message: string } | null }> {
  try {
    const res = await fetch('/api/collection?' + new URLSearchParams({ select: '*', ...opts }))
    const json = await res.json()
    if (!res.ok) return { data: [], error: { message: json.error || 'Failed to load collection' } }
    return { data: json.data || [], error: null }
  } catch (e) {
    return { data: [], error: { message: e instanceof Error ? e.message : 'Network error' } }
  }
}
