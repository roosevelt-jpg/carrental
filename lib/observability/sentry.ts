import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(runtime: "app" | "worker" = "app") {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
    initialScope: {
      tags: { runtime },
    },
  });
  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN) {
    console.error(
      JSON.stringify({
        msg: "exception",
        error: error instanceof Error ? error.message : String(error),
        ...context,
      }),
    );
    return;
  }
  Sentry.captureException(error, { extra: context });
}
