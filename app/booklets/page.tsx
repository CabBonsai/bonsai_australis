'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type SpeciesResult = { sp_no: number; species: string; species_genus: string; common_name: string | null };
type BookletListItem = {
  id: string;
  sp_no: number;
  species_name: string;
  common_name: string | null;
  title: string | null;
  status: string;
  price: number | null;
  version: number;
  updated_at: string;
  published_at: string | null;
};
type Booklet = {
  id: string;
  sp_no: number;
  title: string | null;
  status: string;
  price: number | null;
  version: number;
  content: string | null;
  pdf_url: string | null;
};
type ReferenceCategory = { id: string; label: string; sections: { table: string; data: Record<string, unknown> | null }[] };

const STATUS_COLORS: Record<string, string> = {
  draft: '#9ca3af',
  in_review: '#D9A02B',
  ready: '#55702A',
  published: '#2E2510',
};

export default function BookletsPage() {
  const [view, setView] = useState<'dashboard' | 'editor'>('dashboard');
  const [booklets, setBooklets] = useState<BookletListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Species picker (for starting a new booklet from the dashboard)
  const [query, setQuery] = useState('');
  const [speciesResults, setSpeciesResults] = useState<SpeciesResult[]>([]);

  // Editor state
  const [activeSpNo, setActiveSpNo] = useState<number | null>(null);
  const [booklet, setBooklet] = useState<Booklet | null>(null);
  const [reference, setReference] = useState<{ species: SpeciesResult; categories: ReferenceCategory[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const loadList = useCallback(() => {
    setLoadingList(true);
    fetch('/api/booklets?mode=list')
      .then((r) => r.json())
      .then((d) => setBooklets(d.booklets ?? []))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

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

  const openBooklet = useCallback((spNo: number) => {
    setActiveSpNo(spNo);
    setView('editor');
    setBooklet(null);
    setReference(null);
    setQuery('');
    setSpeciesResults([]);

    fetch(`/api/booklets?mode=get&sp_no=${spNo}`)
      .then((r) => r.json())
      .then((d) => setBooklet(d.booklet));

    fetch(`/api/booklets?mode=reference&sp_no=${spNo}`)
      .then((r) => r.json())
      .then((d) => setReference(d));
  }, []);

  const saveBooklet = useCallback(
    (fields: Partial<Booklet>) => {
      if (!booklet) return;
      setSaving(true);
      fetch('/api/booklets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booklet.id, ...fields }),
      })
        .then((r) => r.json())
        .then((d) => {
          setBooklet(d.booklet);
          setSavedAt(new Date().toLocaleTimeString());
        })
        .finally(() => setSaving(false));
    },
    [booklet]
  );

  // Debounced autosave for the content textarea
  useEffect(() => {
    if (!booklet) return;
    const handle = setTimeout(() => {
      saveBooklet({ content: booklet.content });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 1500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booklet?.content]);

  const printBooklet = useCallback(() => {
    window.print();
  }, []);

  return (
    <div style={{ maxWidth: view === 'editor' ? '1400px' : '900px', margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: '4px' }} className="no-print">
        {view === 'editor' ? (
          <button
            onClick={() => setView('dashboard')}
            style={{ fontSize: '13px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            &larr; Booklet Studio
          </button>
        ) : (
          <Link href="/" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>
            &larr; Dashboard
          </Link>
        )}
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0 0' }}>
          {view === 'dashboard' ? 'Booklet Studio' : booklet?.title ?? reference?.species.species ?? 'Loading...'}
        </h1>
      </div>

      {view === 'dashboard' && (
        <>
          {/* Species search to start a new booklet */}
          <div style={{ marginTop: '16px', marginBottom: '24px', position: 'relative' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '13px' }}>
              Start or open a booklet
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search species..."
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
            />
            {speciesResults.length > 0 && (
              <ul
                style={{
                  position: 'absolute', zIndex: 10, background: '#fff', border: '1px solid #ccc', width: '100%',
                  maxHeight: 240, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0,
                }}
              >
                {speciesResults.map((s) => (
                  <li
                    key={s.sp_no}
                    onClick={() => openBooklet(s.sp_no)}
                    style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                  >
                    <strong>{s.species}</strong>
                    {s.common_name ? ` — ${s.common_name}` : ''} <span style={{ color: '#888' }}>({s.species_genus})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Status dashboard */}
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 8 }}>All booklets</h2>
          {loadingList && <p style={{ color: '#888' }}>Loading...</p>}
          {!loadingList && booklets.length === 0 && <p style={{ color: '#888' }}>No booklets started yet - search above to begin one.</p>}
          {booklets.map((b) => (
            <div
              key={b.id}
              onClick={() => openBooklet(b.sp_no)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px',
                border: '1px solid #eee', borderRadius: 4, marginBottom: 6, cursor: 'pointer',
              }}
            >
              <div>
                <strong>{b.species_name}</strong>
                {b.common_name ? ` — ${b.common_name}` : ''}
                <span style={{ color: '#888', fontSize: '12px', marginLeft: 8 }}>v{b.version}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {b.price != null && <span style={{ fontSize: '13px', color: '#555' }}>${b.price.toFixed(2)}</span>}
                <span
                  style={{
                    fontSize: '11px', color: '#fff', background: STATUS_COLORS[b.status] ?? '#9ca3af',
                    padding: '3px 8px', borderRadius: 10, textTransform: 'uppercase',
                  }}
                >
                  {b.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      {view === 'editor' && (
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
          {/* Left: reference panel - read-only pull of all 13 categories */}
          <div className="no-print" style={{ flex: '0 0 40%', maxHeight: '80vh', overflowY: 'auto', border: '1px solid #eee', borderRadius: 4, padding: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>
              Reference data (read-only)
            </h3>
            {!reference && <p style={{ color: '#888' }}>Loading reference data...</p>}
            {reference?.categories.map((cat) => {
              const hasContent = cat.sections.some((s) => s.data && Object.values(s.data).some((v) => v !== null && v !== ''));
              if (!hasContent) return null;
              return (
                <details key={cat.id} style={{ marginBottom: 8 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '13px', padding: '4px 0' }}>{cat.label}</summary>
                  {cat.sections.map((section, i) => (
                    <div key={i} style={{ marginLeft: 8, marginBottom: 8 }}>
                      {section.data &&
                        Object.entries(section.data)
                          .filter(([k, v]) => k !== 'sp_no' && v !== null && v !== '')
                          .map(([k, v]) => (
                            <div key={k} style={{ marginBottom: 6, fontSize: '12px' }}>
                              <div style={{ color: '#888', fontWeight: 600 }}>{k}</div>
                              <div style={{ whiteSpace: 'pre-wrap' }}>{String(v)}</div>
                            </div>
                          ))}
                    </div>
                  ))}
                </details>
              );
            })}
          </div>

          {/* Right: editor */}
          <div style={{ flex: '1 1 60%' }}>
            <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={booklet?.title ?? ''}
                onChange={(e) => setBooklet((b) => (b ? { ...b, title: e.target.value } : b))}
                onBlur={() => saveBooklet({ title: booklet?.title })}
                placeholder="Booklet title"
                style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, flex: '1 1 200px' }}
              />
              <select
                value={booklet?.status ?? 'draft'}
                onChange={(e) => saveBooklet({ status: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }}
              >
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="ready">Ready</option>
                <option value="published">Published</option>
              </select>
              <input
                type="number"
                step="0.01"
                value={booklet?.price ?? ''}
                onChange={(e) => setBooklet((b) => (b ? { ...b, price: e.target.value ? Number(e.target.value) : null } : b))}
                onBlur={() => saveBooklet({ price: booklet?.price })}
                placeholder="Price $"
                style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4, width: '90px' }}
              />
              <button
                onClick={printBooklet}
                style={{ padding: '6px 14px', background: '#2E2510', color: '#FBF7EC', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Print / Save PDF
              </button>
              <span style={{ fontSize: '12px', color: '#888' }}>
                {saving ? 'Saving...' : savedAt ? `Saved ${savedAt}` : ''}
              </span>
            </div>

            <textarea
              value={booklet?.content ?? ''}
              onChange={(e) => setBooklet((b) => (b ? { ...b, content: e.target.value } : b))}
              placeholder="Write the booklet here (Markdown supported)..."
              style={{
                width: '100%', minHeight: '70vh', padding: '16px', border: '1px solid #ccc', borderRadius: 4,
                fontFamily: 'Georgia, serif', fontSize: '15px', lineHeight: 1.6, resize: 'vertical',
              }}
            />
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          textarea { border: none !important; white-space: pre-wrap; }
        }
      `}</style>
    </div>
  );
}
