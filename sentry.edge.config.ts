// sentry.edge.config.ts
//
// Edge runtime Sentry init — covers middleware.ts and any edge-runtime routes.
// Loaded from instrumentation.ts when NEXT_RUNTIME === 'edge'.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://aeb3e10c1f3874e2c0612d4764b3c103@o4512042606854144.ingest.us.sentry.io/4512042615898112",
  tracesSampleRate: 1.0,
  debug: false,
});
