// instrumentation.ts
//
// Next.js instrumentation hook — runs once when the server starts. Loads the
// right Sentry config depending on which runtime this particular process is
// (Node.js server functions vs. the Edge runtime used by middleware.ts).

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
