# Bonsai Australis — Standing Audit Kit

*First compiled session 10. Amended sessions 14 through 51 — see "Amendment
History" at the end.*

---

## Why these checks exist

See prior versions of this file for the full catalogue of bug shapes found
through session 48 (Principle 61, session 35, on the "see prior versions"
retrieval risk — the canonical SQL below is saved verbatim since session 44;
copy it forward rather than reconstructing).

---

## Session 53 — Standing Audit Kit numbers (session close, extended session)

| Check | Session open | Session close |
|---|---|---|
| 1 — Family Default high scores (≥85) | 0 | **0** — Clean |
| 6 — tier/suitability mirror mismatch | 0 | **0** — Clean |
| 55 — sp_no collisions | 0 | **0** — Clean (see also: a genuine species-name duplicate was found and merged this session — sp_no 1880/"resinocostata" deprecated → 1877/"resinicostata" — this check doesn't catch same-genus different-sp_no near-duplicates, only exact sp_no collisions; worth knowing this check has a blind spot for that bug shape) |
| Item 59 backlog | 12,879 | **12,881** — up 2, minor, plausibly explained by new species rows created this session (auto-trigger populates blank `bonsai_suitability` rows on insert), not chased further |
| Check 3 — root_tolerance_notes contamination | 1,733 | **1,733** — unchanged |

**New this session: dedicated status-mismatch audit (Steve's direct
request, following the pattern surfacing organically 4 times).**
Systematic query across `species` and all 13 category tables for
"`research_status` claims Verified/Complete, but the underlying content
field is NULL or the citation doesn't actually support the claim."
**12 real mismatches found, all fixed.** Detection query (species-level):

```sql
SELECT sp_no, species, research_status, data_source
FROM species
WHERE research_status IN ('Complete','Verified')
  AND (data_source ILIKE '%Family Default%' OR data_source ILIKE '%Legacy%'
       OR data_source ILIKE '%Unverified%' OR data_source IS NULL);
```

Category-table version (repeat per table, swapping the primary content
column — see session notes for the full 13-table UNION query used):

```sql
SELECT sp_no, research_status FROM pruning_protocols
WHERE research_status ILIKE 'Verified%' AND old_wood_management IS NULL;
```

**Caveat found while running this**: a naive `data_source ILIKE '%Family
Default%'` check throws false positives where a field's real content
narrates its own correction history (e.g. "corrected from Family Default
template") — check the actual content field for NULL/genuine-boilerplate
match, not just a data_source string match, or you'll flag real content
as broken.

**This check is a strong candidate for addition to the standing 5** —
it found 12 real, previously-invisible content gaps in one pass. Not yet
promoted to the canonical five below; recommend trialling it again next
session before deciding whether to formalise it.

---

## Session 51 — Standing Audit Kit numbers (session open)

| Check | Result | Note |
|---|---|---|
| 1 — Family Default high scores (≥85) | **0** | Clean |
| 6 — tier/suitability mirror mismatch | **0** | Clean |
| 55 — sp_no collisions | **0** | Clean |
| Item 59 backlog | **12,872** | **Up 6** from session 48's 12,866 |
| Check 3 — root_tolerance_notes contamination | **1,734** | Unchanged from session 48's 1,734 |

**Item 59 moved the wrong direction this session — flagged, not
investigated.** Working theory (not yet confirmed): the 6 new variant
rows added later in this same session (sp_no 13545–13550, Marcela
Ferreira video batch) each start with unpopulated `bonsai_suitability`
trait columns, which is correct/expected behavior for genuinely
unresearched new material — not fabrication, not drift — but would
show up in this count. **Next session should confirm this explicitly**
(e.g. re-run Item 59 filtered to `sp_no NOT IN (13545,13546,13547,13548,
13549,13550)` and check whether it nets back to 12,866) rather than
carrying the assumption forward unverified.

---

## Canonical SQL (unchanged since session 44 — copy forward verbatim)

Run all five as separate queries; multi-statement batches in Supabase MCP
only return the last statement's result.

**Check 1 — Family Default high scores:**
```sql
SELECT COUNT(*) FROM bonsai_suitability
WHERE data_source = 'Family Default' AND final_bonsai_score >= 85;
```

**Check 6 — tier/suitability text-mirror mismatch:**
```sql
SELECT COUNT(*) FROM bonsai_suitability
WHERE bonsai_tier IS DISTINCT FROM bonsai_suitability;
```

**Check 55 — sp_no collisions:**
```sql
SELECT COUNT(*) FROM (
  SELECT sp_no FROM species GROUP BY sp_no HAVING COUNT(*) > 1
) x;
```

**Item 59 backlog — rows missing at least one of the 10 BAMSR traits:**
```sql
SELECT COUNT(*) FROM bonsai_suitability
WHERE back_budding_ability IS NULL OR ramification_potential IS NULL OR
      leaf_reduction_potential IS NULL OR vigor IS NULL OR
      root_tolerance_score IS NULL OR wire_bend_tolerance IS NULL OR
      nebari_potential_score IS NULL OR bark_character_score IS NULL OR
      taper_movement_score IS NULL OR longevity_score IS NULL;
```
**Do NOT** additionally filter on `final_bonsai_score IS NOT NULL` — the
post-session-41 Reconciliation Rule trigger fix means a row with incomplete
traits will always have `final_bonsai_score = NULL` already.

**Check 3 — root_tolerance_notes phantom category-tag contamination:**
```sql
SELECT COUNT(*) FROM bonsai_suitability
WHERE root_tolerance_notes IS NOT NULL
  AND data_source = 'Family Default'
  AND research_status = 'Not Started'
  AND root_tolerance_notes NOT ILIKE '%tolera%'
  AND root_tolerance_notes NOT ILIKE '%root%'
  AND root_tolerance_notes NOT ILIKE '%prun%'
  AND root_tolerance_notes NOT ILIKE '%repot%';
```
**Must** be scoped to `data_source = 'Family Default' AND research_status =
'Not Started'` specifically — an unscoped query also catches legitimate
Genus-inferred rows and over-counts.

**Check 7 — orphaned collection stub rows (new session 56):**
```sql
SELECT collection_id, sp_no, display_name, created_at FROM collection
WHERE tree_number IS NULL
  AND tree_name IS NULL
  AND created_at = updated_at
  AND created_at < now() - interval '1 day';
```
Root cause (traced session 56, not yet fixed at the code level):
`app/collection/page.tsx`'s `handleAddTree()` writes a real row to the
`collection` table the instant the "Add Tree" button is clicked — before
any tree details exist — then redirects to the edit page. If that edit
page is abandoned without saving anything further, the bare stub
(sp_no/display_name only, everything else NULL) sits there forever with
no cleanup path. 4 found and deleted session 56 (2 genuinely abandoned;
2 where the real tree was correctly added moments later via a different
flow — one to Collection, one to Tubestock — leaving the stub behind as
a duplicate). The `created_at = updated_at` condition specifically
excludes rows genuinely being edited right now; the 1-day window gives
real in-progress edits room before flagging. Safe to delete any hits
after a quick confirm with Steve that nothing legitimate is mid-edit.
Proper fix needs restructuring the add-flow (defer the insert to first
real save) — not done session 56, since it can't be verified without a
live test.

---

## New finding, session 51: wishlist search excludes variants

Live-tested by Steve: "Add plants seen" wishlist search returns no result
for *Melaleuca squamea* × *squarrosa* (sp_no 13545, a variant added this
session). Follow-up confirmed plain species search (*Melaleuca squamea*
alone) works correctly and returns a match.

**Scope confirmed: isolated to variants, not a general search fault.**
`wishlist_items.sp_no` carries no structural FK restricting it to
species-only, so this is almost certainly a frontend search query built
against the `species` table only — same underlying bug shape as the
session-48 `collection_detail` view crash (query blind to variant-only
sp_nos). Not fixed this session — needs Claude Code. Fix shape: add a
variants search branch/union to the "Add plants seen" query.

---

## Standing principle, session 51

**70. When sourcing a video/transcript-based source, a name spoken but
never shown on a tag/label should be held back rather than recorded,
even from an otherwise-qualifying Recognised Specialist — especially
once the same transcript has already proven unreliable on names
elsewhere in the same session.** Demonstrated this session on
*Leptospermum morrisonii* "Burgundy": withheld for the full session after
the transcript-only mention, then added properly once Steve supplied an
independent corroborating source (Angus Stewart, Gardening With Angus),
upgrading it to full Verified on 2 independent sources rather than a
guessed single-source entry. This is Principle 67/69's "don't assume
honesty/accuracy propagates" logic applied specifically to auto-transcript
name reliability, not just to database row contents.

---

## How to use this kit

Unchanged. Run the SQL blocks above verbatim at the start of every session.

---

## Amendment History

**Sessions 14–47:** See prior versions of this file for full detail.

**Session 48:** Standing Audit Kit run clean at open. Full 13-category
sweep on Flindersia australis. New Principle 69 recorded on row-level
honesty not propagating across a full species record. Booklet Studio
template finalised. Claude Code set up and used for the first time —
two real fixes shipped (variant-linked tree detail-page crash, PDF
report hardening).

**Sessions 49–50:** Research Pod process established and first run
(Ceratopetalum gummiferum, Tree 82). `next_measurement_date` app bug
found (not yet fixed).

**Session 51:** Standing Audit Kit run at open — checks 1/6/55 clean,
Item 59 backlog up 6 (12,866→12,872, unexplained, working theory pending
confirmation), Check 3 unchanged. Tree 118 (Eucalyptus camaldulensis)
work plan established from a live photo. Monthly species action-flag
screen backlog feature defined and successfully test-derived against
Ficus rubiginosa (sp_no 8397) — surfaced a genuine unresolved repot-
timing source conflict. Large Marcela Ferreira video batch processed:
6 new variants (sp_no 13545–13550), 8 species notes added, all upgraded
to Verified – Recognised Specialist given confirmed presenter identity.
New Principle 70 recorded on holding back transcript-only names pending
independent corroboration — demonstrated directly on the "Burgundy"
cultivar, which was correctly withheld then added once Steve supplied a
second source. New app bug found and scoped: wishlist "Add plants seen"
search excludes variants (isolated to variants specifically, confirmed
via live test against a working plain-species search) — needs Claude
Code, same fix shape as the session-48 collection_detail crash.

**Session 53 (extended):** Ran unusually long, five phases. Standing
Audit Kit clean at open and close; Item 59 up 2 (minor, plausible, not
chased). New dedicated status-mismatch audit run for the first time —
12 real content gaps found and fixed across species + 13 category
tables (see numbers table above for detail and detection SQL) —
candidate for promotion to the canonical five checks, pending a second
trial run. Two data-integrity fixes: a duplicate collection-tree
double-add (trees 154/155, both actually tubestock TS0019 — fixed
without losing an active Research Pod link by re-pointing it to
`tubestock` rather than `collection`) and a genuine species-name
duplicate merge (Acacia resinicostata/resinocostata — verified as a
real 1974 orthographic correction via World Wide Wattle before merging,
not assumed). Full 13-category sweeps run on 7 species (Vitis vinifera,
Melia azedarach, Rhododendron 'Candy Lights', Juniperus communis,
Callistemon citrinus, Acacia conferta, Platycladus orientalis) plus a
large VNBC newsletter/archive backlog batch (~30 species/variants, ~10
documents). New working-pattern note: a "try harder" push-back from
Steve on the Juniperus communis first pass led directly to that
species' single most important finding on a second, more targeted
search — worth treating as a legitimate signal the first pass
under-delivered, not just a request for more words. New pattern: Steve's
own first-hand photos (Ligustrum undulatum back-budding evidence; two
Flickr photos set as species reference images) now resolving real gaps
no external source could reach. Full detail in this session's
PROJECT_STATUS.md.
