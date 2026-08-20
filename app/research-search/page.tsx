'use client';

import { useState, useEffect, useCallback } from 'react';

type SpeciesResult = { sp_no: number; species: string; species_genus: string; common_name: string | null };
type VariantResult = { sp_no: number; variant_name: string; common_name: string | null; botanical_rank: string | null; is_deprecated: boolean };
type Topic = { id: string; label: string };
type Section = { table: string; data: Record<string, unknown> | null; error: string | null };
type ContentResult = {
  subject: { kind: string; name: string; common_name: string | null };
  topic: { id: string; label: string };
  sections: Section[];
  effectiveCare: Record<string, unknown> | null;
  error?: string;
};

export default function ResearchSearchPage() {
  const [query, setQuery] = useState('');
  const [speciesResults, setSpeciesResults] = useState<SpeciesResult[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesResult | null>(null);
  const [variants, setVariants] = useState<VariantResult[]>([]);
  const [selectedSpNo, setSelectedSpNo] = useState<number | null>(null); // active sp_no: species' own, or a chosen variant's own
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [content, setContent] = useState<ContentResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/research-search?mode=topics')
      .then((r) => r.json())
      .then((d) => setTopics(d.topics ?? []));
  }, []);

  // Debounced species typeahead
  useEffect(() => {
    if (query.trim().length < 2) {
      setSpeciesResults([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/research-search?mode=species&q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setSpeciesResults(d.results ?? []));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const pickSpecies = useCallback((s: SpeciesResult) => {
    setSelectedSpecies(s);
    setSelectedSpNo(s.sp_no);
    setSpeciesResults([]);
    setQuery(s.species);
    setContent(null);
    fetch(`/api/research-search?mode=variants&sp_no=${s.sp_no}`)
      .then((r) => r.json())
      .then((d) => setVariants(d.results ?? []));
  }, []);

  const pickVariant = useCallback(
    (variantSpNo: string) => {
      setContent(null);
      setSelectedSpNo(variantSpNo ? Number(variantSpNo) : selectedSpecies?.sp_no ?? null);
    },
    [selectedSpecies]
  );

  const runSearch = useCallback(() => {
    if (!selectedSpNo || !selectedTopic) return;
    setLoading(true);
    fetch(`/api/research-search?mode=content&sp_no=${selectedSpNo}&topic=${selectedTopic}`)
      .then((r) => r.json())
      .then((d) => setContent(d))
      .finally(() => setLoading(false));
  }, [selectedSpNo, selectedTopic]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Research Search</h1>

      {/* Species search */}
      <div style={{ marginBottom: '1rem', position: 'relative' }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Species</label>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedSpecies(null);
            setSelectedSpNo(null);
            setVariants([]);
            setContent(null);
          }}
          placeholder="Start typing a species name..."
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
        />
        {speciesResults.length > 0 && (
          <ul
            style={{
              position: 'absolute',
              zIndex: 10,
              background: '#fff',
              border: '1px solid #ccc',
              width: '100%',
              maxHeight: 240,
              overflowY: 'auto',
              listStyle: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {speciesResults.map((s) => (
              <li
                key={s.sp_no}
                onClick={() => pickSpecies(s)}
                style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #eee' }}
              >
                <strong>{s.species}</strong>
                {s.common_name ? ` — ${s.common_name}` : ''} <span style={{ color: '#888' }}>({s.species_genus})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Variant dropdown - only rendered when variants actually exist */}
      {selectedSpecies && variants.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Variant (optional)</label>
          <select
            onChange={(e) => pickVariant(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          >
            <option value="">— Species itself (no variant) —</option>
            {variants.map((v) => (
              <option key={v.sp_no} value={v.sp_no}>
                {v.variant_name}
                {v.botanical_rank ? ` (${v.botanical_rank})` : ''}
                {v.is_deprecated ? ' [deprecated]' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Topic dropdown */}
      {selectedSpNo && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>What are you looking for?</label>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          >
            <option value="">— Select —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedSpNo && selectedTopic && (
        <button
          onClick={runSearch}
          disabled={loading}
          style={{ padding: '0.5rem 1.5rem', background: '#2E2510', color: '#FBF7EC', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      )}

      {/* Results */}
      {content && !content.error && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem' }}>
            {content.subject.name} {content.subject.common_name ? `— ${content.subject.common_name}` : ''}
          </h2>
          <p style={{ color: '#888', marginBottom: '1rem' }}>
            {content.topic.label} · sp_no {selectedSpNo}
          </p>

          {content.effectiveCare && (
            <div style={{ background: '#FBF7EC', border: '1px solid #D9A02B', borderRadius: 4, padding: '1rem', marginBottom: '1rem' }}>
              <strong>Effective (variant-resolved) care</strong>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: 8 }}>
                {JSON.stringify(content.effectiveCare, null, 2)}
              </pre>
            </div>
          )}

          {content.sections.map((section, i) => (
            <div key={i} style={{ marginBottom: '1.5rem', border: '1px solid #eee', borderRadius: 4, padding: '1rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>{section.table}</h3>
              {section.error && <p style={{ color: 'red' }}>{section.error}</p>}
              {!section.error && !section.data && <p style={{ color: '#888' }}>No row for this sp_no.</p>}
              {section.data && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {Object.entries(section.data)
                      .filter(([k]) => k !== 'sp_no')
                      .map(([k, v]) => (
                        <tr key={k} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '4px 8px', fontWeight: 600, verticalAlign: 'top', width: '30%', color: '#555' }}>{k}</td>
                          <td style={{ padding: '4px 8px', whiteSpace: 'pre-wrap' }}>
                            {v === null || v === '' ? <em style={{ color: '#bbb' }}>empty</em> : String(v)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {content?.error && <p style={{ color: 'red', marginTop: '1rem' }}>{content.error}</p>}
    </div>
  );
}
