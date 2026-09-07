// sentry.server.config.ts
//
// Server-side (Node.js runtime) Sentry init — API routes, server components.
// Loaded from instrumentation.ts when NEXT_RUNTIME === 'nodejs'.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://aeb3e10c1f3874e2c0612d4764b3c103@o4512042606854144.ingest.us.sentry.io/4512042615898112",

  // Sends 100% of errors — this is a small, low-traffic internal admin tool,
  // so there's no volume concern that would justify sampling errors down.
  tracesSampleRate: 1.0,

  // Set to true temporarily if Sentry itself seems to be misbehaving.
  debug: false,
});
