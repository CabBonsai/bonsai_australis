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

export default function CareSheetSettingsPage() {
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
    <div style={{ padding: '2rem', maxWidth: 560 }}>
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

      <div style={{ fontSize: '0.85rem', color: '#888' }}>
        Last updated: {settings ? new Date(settings.updated_at).toLocaleString() : '—'}
      </div>
    </div>
  );
}
