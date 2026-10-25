// App-specific names on purpose: hosting integrations (e.g. Vercel's Supabase
// store) inject their own NEXT_PUBLIC_SUPABASE_* values at runtime, which
// silently pointed production at a different project. Only server code uses
// these, so they need no NEXT_PUBLIC_ prefix. Both values are public anyway:
// access to data is enforced by RLS, and the secret key is never used here.
export function supabaseEnv() {
  const url = process.env.SALONFLOW_SUPABASE_URL;
  const publishableKey = process.env.SALONFLOW_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Missing SALONFLOW_SUPABASE_URL or SALONFLOW_SUPABASE_PUBLISHABLE_KEY (see .env.example)",
    );
  }
  return { url, publishableKey };
}
