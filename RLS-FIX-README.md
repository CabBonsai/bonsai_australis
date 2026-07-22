# RLS fix — API route files

These 5 files replace direct client-side Supabase calls to the 4 now-locked-down
tables (`research_projects`, `research_project_trees`, `research_project_journal`,
`tubestock`) with server-side API routes using the service role key.

## Where each file goes

| File (here) | Destination in bonsai-admin |
|---|---|
| `supabaseServer.ts` | `lib/supabaseServer.ts` |
| `tubestock/route.ts` | `app/api/tubestock/route.ts` |
| `research-projects/route.ts` | `app/api/research-projects/route.ts` |
| `research-project-trees/route.ts` | `app/api/research-project-trees/route.ts` |
| `research-project-journal/route.ts` | `app/api/research-project-journal/route.ts` |

(Create the `app/api/...` folders if they don't exist yet — Next.js just needs
a `route.ts` file inside each folder.)

## Before this works: one env var

Add `SUPABASE_SERVICE_ROLE_KEY` in Vercel → Project Settings → Environment
Variables (Production, Preview, and Development — all three environments).

Find the actual key value in Supabase dashboard → Project Settings → API →
`service_role` `secret` key. **Never** prefix this one with `NEXT_PUBLIC_` —
that would ship it to the browser, defeating the entire point of this fix.

If you also want to run this locally, add the same line to `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Column-name assumptions — confirm before pushing

I don't have visibility into the actual bonsai-admin code, so these routes
assume:
- `tubestock` — primary key `sp_no` (matches the rest of the schema)
- `research_projects` — primary key `id`
- `research_project_trees` — primary key `id`, foreign key `project_id`
- `research_project_journal` — primary key `id`, foreign key `project_id`

If any of these are wrong, it's a one-line change at the top of the relevant
route file (`ID_COLUMN` / `PROJECT_FK` / `SP_NO_COLUMN` constants) — nothing
else needs to change.

## Updating the pages that currently query these tables directly

Wherever the Tubestock or Research Pod pages currently do something like:

```ts
const { data, error } = await supabase.from('tubestock').select('*');
```

replace with:

```ts
const res = await fetch('/api/tubestock');
const data = await res.json();
if (!res.ok) {
  // data.error holds the message
}
```

Insert:
```ts
// before: await supabase.from('tubestock').insert(newRow);
await fetch('/api/tubestock', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newRow),
});
```

Update:
```ts
// before: await supabase.from('tubestock').update(changes).eq('sp_no', spNo);
await fetch('/api/tubestock', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sp_no: spNo, ...changes }),
});
```

Delete:
```ts
// before: await supabase.from('tubestock').delete().eq('sp_no', spNo);
await fetch(`/api/tubestock?sp_no=${spNo}`, { method: 'DELETE' });
```

Same pattern for the other three tables, swapping the URL and the key field
(`id` instead of `sp_no`, and include `project_id` where relevant).

I haven't touched the actual page files since I can't see them from here —
you'll need to find each `supabase.from('tubestock' | 'research_projects' |
'research_project_trees' | 'research_project_journal')` call in the admin
codebase and swap it to the matching `fetch('/api/...')` call above.

## Verify before pushing

1. Confirm the 5 new files landed in the right paths (`dir` each folder).
2. Confirm the env var is set in Vercel for all 3 environments.
3. `git add`, `git commit`, `git push` — three separate commands.
4. After deploy, load the Tubestock and Research Pod pages live and confirm
   data still loads/saves — this is the real test, since none of this can be
   verified from here.
