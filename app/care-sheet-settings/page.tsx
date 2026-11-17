// Destination: bonsai-admin/app/care-sheet-settings/page.tsx
// Uses the existing anon client for the read (RLS allows anon SELECT on
// care_sheet_settings) and the new service-role API route for any write.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface CareSheetSettings {
  id: number;
  enabled: boolean;
  generation_count: number;
  updated_at: string;
}

interface RankRow {
  sp_no: number;
  species: string;
  common_name: string | null;
  downloads: number;
  downloads_30d: number;
  last_download: string;
  overall_completeness: number | null;
  bonsai_tier: string | null;
  research_status: string | null;
  needs_verification: boolean | null;
}

export default function CareSheetSettingsPage() {
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const [settings, setSettings] = useState<CareSheetSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('care_sheet_settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (error) {
      setError(error.message);
    } else {
      setSettings(data);
      setError(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
    fetch('/api/care-sheet-downloads')
      .then(r => r.json())
      .then(j => setRanking(j.data || []))
      .catch(() => setRanking([]));
  }, []);

  const callUpdate = async (payload: { enabled?: boolean; resetCount?: boolean }) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/care-sheet-settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Update failed');
      setSettings(result.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = () => {
    if (!settings) return;
    callUpdate({ enabled: !settings.enabled });
  };

  const handleReset = () => {
    if (!confirm('Reset the generation counter to 0? This cannot be undone.')) return;
    callUpdate({ resetCount: true });
  };

  const backLink = (
    <Link
      href="/"
      style={{
        display: 'inline-block',
        fontSize: '13px',
        background: '#f3f4f6',
        color: '#374151',
        padding: '6px 12px',
        borderRadius: '6px',
        textDecoration: 'none',
        marginBottom: '1.5rem',
      }}
    >
      ← Back to Dashboard
    </Link>
  );

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        {backLink}
        <div>Loading care sheet settings…</div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div style={{ padding: '2rem' }}>
        {backLink}
        <div style={{ color: '#b3261e' }}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 960 }}>
      {backLink}

      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
        Care Sheet Generator — Settings
      </h1>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>Public generator status</div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              {settings?.enabled
                ? 'Live — visitors can generate care sheets.'
                : 'Disabled — visitors see an unavailable message.'}
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={saving}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: 6,
              border: 'none',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              backgroundColor: settings?.enabled ? '#2E2510' : '#55702A',
              color: '#FBF7EC',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {settings?.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '1rem',
            borderTop: '1px solid #eee',
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>Total generations</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              {settings?.generation_count ?? 0}
            </div>
          </div>
          <button
            onClick={handleReset}
            disabled={saving}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: '1px solid #ccc',
              background: 'transparent',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            Reset counter
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#b3261e', marginBottom: '1rem' }}>{error}</div>}

      <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 0.25rem' }}>Downloads by species</h2>
      <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>
        Counted from when per-species logging started. Sorted by downloads, then least complete first, so popular species with thin data rise to the top.
      </div>
      {ranking.length === 0 ? (
        <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: '1.5rem' }}>No per-species downloads logged yet.</div>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '6px 8px' }}>Species</th>
                <th style={{ padding: '6px 8px' }}>Downloads</th>
                <th style={{ padding: '6px 8px' }}>Last 30d</th>
                <th style={{ padding: '6px 8px' }}>Completeness</th>
                <th style={{ padding: '6px 8px' }}>Tier</th>
                <th style={{ padding: '6px 8px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(r => {
                const thin = (r.overall_completeness ?? 0) < 50 || r.needs_verification === true;
                return (
                  <tr key={r.sp_no} style={{ borderBottom: '1px solid #eee', background: thin ? '#fff7e6' : undefined }}>
                    <td style={{ padding: '6px 8px' }}>
                      <Link href={`/species/${r.sp_no}`} style={{ color: '#55702a' }}>{r.species}</Link>
                      {r.common_name ? <span style={{ color: '#888' }}> — {r.common_name}</span> : null}
                    </td>
                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{r.downloads}</td>
                    <td style={{ padding: '6px 8px' }}>{r.downloads_30d}</td>
                    <td style={{ padding: '6px 8px' }}>{r.overall_completeness ?? '—'}{r.overall_completeness != null ? '%' : ''}</td>
                    <td style={{ padding: '6px 8px' }}>{r.bonsai_tier ?? '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{r.research_status ?? '—'}{r.needs_verification ? ' · needs verification' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: '0.85rem', color: '#888' }}>
        Last updated: {settings ? new Date(settings.updated_at).toLocaleString() : '—'}
      </div>
    </div>
  );
}
