// TEMPORARY diagnostic route — remove after the Vercel env issue is solved.
import { NextResponse } from "next/server";
import { connection } from "next/server";

export async function GET() {
  await connection();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  let status = 0;
  let body = "";
  try {
    const res = await fetch(`${url}/rest/v1/salons?select=id&limit=1`, { headers: { apikey: key } });
    status = res.status;
    body = (await res.text()).slice(0, 200);
  } catch (e) {
    body = String(e);
  }
  return NextResponse.json({
    host: url ? new URL(url).host : null,
    keyPrefix: key.slice(0, 15),
    restStatus: status,
    restBody: body,
  });
}
