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

// Lightweight markdown -> HTML for preview/print. Handles the subset actually used in booklets:
// #/## headers, **bold**, *italic*, --- as a section divider, blank-line-separated paragraphs.
// Deliberately not pulling in a markdown library dependency for this - the format is simple and
// controlled (we write the content ourselves), so a small hand-rolled renderer is enough and
// avoids an extra npm install.
function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      const text = paragraph.join(' ');
      html.push(`<p>${inlineFormat(text)}</p>`);
      paragraph = [];
    }
  };

  const inlineFormat = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
      flushParagraph();
      continue;
    }
    if (line === '---') {
      flushParagraph();
      html.push('<hr />');
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      html.push(`<h2>${inlineFormat(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      flushParagraph();
      html.push(`<h1>${inlineFormat(line.slice(2))}</h1>`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return html.join('\n');
}

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
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');
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

  // Set the actual page title to the booklet's own title while it's open - browsers use
  // document.title for both the tab and the print header, so without this every printed
  // booklet said "Bonsai Australis Admin" (or worse, the old unfixed "Create Next App")
  // instead of the booklet's real name. Resets on the way back to the dashboard.
  useEffect(() => {
    if (view === 'editor' && booklet?.title) {
      document.title = booklet.title;
    } else {
      document.title = 'Booklet Studio - Bonsai Australis Admin';
    }
    return () => {
      document.title = 'Bonsai Australis Admin';
    };
  }, [view, booklet?.title]);

  const printBooklet = useCallback(() => {
    // Switch to preview first if needed, then print on the next tick so the rendered
    // HTML is actually in the DOM before the browser's print dialog captures it.
    setEditorMode('preview');
    setTimeout(() => window.print(), 50);
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
        <div className="editor-flex-container" style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
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
          <div className="editor-column" style={{ flex: '1 1 60%' }}>
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
              <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: 4, overflow: 'hidden' }}>
                <button
                  onClick={() => setEditorMode('write')}
                  style={{
                    padding: '6px 12px', border: 'none', cursor: 'pointer',
                    background: editorMode === 'write' ? '#2E2510' : '#fff',
                    color: editorMode === 'write' ? '#FBF7EC' : '#333',
                  }}
                >
                  Write
                </button>
                <button
                  onClick={() => setEditorMode('preview')}
                  style={{
                    padding: '6px 12px', border: 'none', cursor: 'pointer',
                    background: editorMode === 'preview' ? '#2E2510' : '#fff',
                    color: editorMode === 'preview' ? '#FBF7EC' : '#333',
                  }}
                >
                  Preview
                </button>
              </div>
              <button
                onClick={printBooklet}
                style={{ padding: '6px 14px', background: '#55702A', color: '#FBF7EC', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Print / Save PDF
              </button>
              <span style={{ fontSize: '12px', color: '#888' }}>
                {saving ? 'Saving...' : savedAt ? `Saved ${savedAt}` : ''}
              </span>
            </div>

            {editorMode === 'write' && (
              <textarea
                value={booklet?.content ?? ''}
                onChange={(e) => setBooklet((b) => (b ? { ...b, content: e.target.value } : b))}
                placeholder="Write the booklet here (Markdown supported: # and ## headers, **bold**, *italic*, --- for a divider)..."
                style={{
                  width: '100%', minHeight: '70vh', padding: '16px', border: '1px solid #ccc', borderRadius: 4,
                  fontFamily: 'Georgia, serif', fontSize: '15px', lineHeight: 1.6, resize: 'vertical',
                }}
              />
            )}

            {editorMode === 'preview' && (
              <div id="booklet-preview" className="booklet-preview">
                <div className="booklet-brand">BONSAI AUSTRALIS</div>
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(booklet?.content ?? '') }} />
                <div className="booklet-footer">
                  &copy; {new Date().getFullYear()} Bonsai Australis. All rights reserved. This booklet may not be
                  reproduced or redistributed without permission.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        .booklet-preview {
          box-sizing: border-box;
          max-width: 720px;
          margin: 0 auto;
          padding: 24px 8px;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 16px;
          line-height: 1.7;
          color: #2E2510;
        }
        .booklet-brand {
          text-align: center;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 13px;
          letter-spacing: 3px;
          color: #D9A02B;
          font-weight: bold;
          margin-bottom: 20px;
        }
        .booklet-preview h1 {
          font-size: 30px;
          margin: 0 0 8px;
          text-align: center;
        }
        .booklet-preview h2 {
          font-size: 20px;
          margin: 32px 0 12px;
          border-bottom: 1px solid #D9A02B;
          padding-bottom: 4px;
        }
        .booklet-preview p {
          margin: 0 0 14px;
        }
        .booklet-preview hr {
          border: none;
          border-top: 1px solid #ccc;
          margin: 32px 0;
        }
        .booklet-preview strong {
          color: #2E2510;
        }
        .booklet-footer {
          margin-top: 40px;
          padding-top: 16px;
          border-top: 1px solid #ccc;
          font-size: 11px;
          color: #888;
          text-align: center;
          font-family: Georgia, 'Times New Roman', serif;
        }

        @media print {
          /* Simpler, more robust approach than the previous visibility:hidden trick -
             that technique (hide everything, then re-show just .booklet-preview) is a
             known source of print-pagination bugs in some browsers, and was cutting
             content off partway through the document (truncating at "Wiring" on the
             first real test). Removing non-printable sections from layout entirely with
             display:none, then forcing the remaining flex layout back to a plain block,
             is the standard reliable pattern - nothing left for the print engine to get
             confused about. */
          .no-print { display: none !important; }
          .editor-flex-container {
            display: block !important;
          }
          .editor-column {
            width: 100% !important;
            max-width: 100% !important;
            flex: none !important;
          }
          .booklet-preview {
            width: auto;
            max-width: 100%;
            padding: 0;
            margin: 0;
          }
          .booklet-preview h2 {
            page-break-after: avoid;
          }
          /* page-break-inside: avoid on paragraphs was removed here - it's the likely real
             cause of the truncation bug. Several paragraphs in this booklet are long enough
             that they don't fit within one printable page, and Chrome's known behaviour when
             it can't satisfy an "avoid break" constraint on tall content is to silently stop
             rendering the rest of the document rather than break the paragraph awkwardly
             across the page boundary. Letting paragraphs break normally is far safer - a
             paragraph split across two pages looks slightly less polished than one that
             doesn't, but a document that silently stops halfway through is a much worse
             outcome, and it's exactly what was happening. */
          @page {
            margin: 0.75in;
          }
        }
      `}</style>
    </div>
  );
}
