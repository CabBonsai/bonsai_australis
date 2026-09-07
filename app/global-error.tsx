'use client'

// app/global-error.tsx
//
// Next.js App Router's top-level error boundary. Catches any error that
// escapes a normal page/component render and would otherwise just show a
// blank white screen with nothing logged anywhere. Reports it to Sentry,
// then shows a plain, honest fallback instead of a blank page.

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: 'sans-serif', padding: '40px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '8px' }}>Something went wrong.</h2>
        <p style={{ color: '#6b7280', marginBottom: '20px' }}>
          The error has been reported automatically. Try again, or go back.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: '10px 20px', borderRadius: '8px', border: 'none',
            background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: '14px',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
