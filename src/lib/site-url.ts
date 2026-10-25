import "server-only";
import { headers } from "next/headers";

// Absolute site origin for links in emails. SALONFLOW_SITE_URL wins when set
// (recommended in production); otherwise derived from the request.
export async function siteOrigin(): Promise<string> {
  const configured = process.env.SALONFLOW_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
