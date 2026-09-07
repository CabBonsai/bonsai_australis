// instrumentation-client.ts
//
// Browser-side Sentry init. Auto-loaded by Next.js before any other client
// code runs — this is the current recommended pattern for apps using
// Turbopack (this repo's build tool), replacing the older sentry.client.config.ts
// + webpack-plugin approach, which isn't Turbopack-compatible.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://aeb3e10c1f3874e2c0612d4764b3c103@o4512042606854144.ingest.us.sentry.io/4512042615898112",
  tracesSampleRate: 1.0,
  debug: false,
});

// Required export — Next.js calls this on client-side navigation errors.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
