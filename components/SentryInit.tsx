'use client'

// components/SentryInit.tsx
//
// WORKAROUND: as of this Next.js/Turbopack combination, the standard
// `instrumentation-client.ts` auto-load convention is NOT being picked up
// (confirmed session 56 — diagnostic console.log placed there never fired
// on page load, even after a clean hard refresh). This is a known rough
// edge with Next.js 16 + Turbopack (Sentry isn't auto-injected the way it
// is under webpack). Workaround: initialize Sentry manually from a client
// component mounted in the root layout, via useEffect + dynamic import so
// it only runs in the browser.
//
// If a future Next.js/Turbopack release fixes the instrumentation-client.ts
// auto-load, this component becomes redundant (harmless to leave — Sentry.init
// is safe to call more than once) but could be removed then.

import { useEffect } from 'react'

const SENTRY_DSN = "https://aeb3e10c1f3874e2c0612d4764b3c103@o4512042606854144.ingest.us.sentry.io/4512042615898112"

export default function SentryInit() {
  useEffect(() => {
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: 1.0,
        debug: false,
      })
    })
  }, [])

  return null
}
