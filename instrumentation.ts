// Next.js runs this once per server process at startup.
// Use it to fail-fast on missing required env vars in production.
//
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadEnv } = await import("@/lib/env");
    loadEnv();
  }
}
