// instrumentation-client.ts
//
// Browser-side Sentry init, per Sentry's official convention for Next.js +
// Turbopack. CONFIRMED (session 56) this file is NOT actually being loaded
// by this project's specific Next.js/Turbopack combination — a diagnostic
// console.log placed here never fired, even on a clean hard refresh. The
// real client-side init now lives in components/SentryInit.tsx, mounted
// manually from app/layout.tsx as a workaround. This file is left in place
// harmlessly in case a future Next.js release starts respecting it (Sentry.init
// is safe to call twice) — but do not rely on it working right now.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://aeb3e10c1f3874e2c0612d4764b3c103@o4512042606854144.ingest.us.sentry.io/4512042615898112",
  tracesSampleRate: 1.0,
  debug: false,
});

// Required export — Next.js calls this on client-side navigation errors.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
