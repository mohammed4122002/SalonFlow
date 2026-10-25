import type { NextRequest } from "next/server";
import { UUID_RE, apiOk, badRequest, fromDbError, requireKey } from "@/lib/api";
import { createAnonClient } from "@/lib/supabase/anon";

// Active specialists; ?service_id= limits to those offering that service.
export async function GET(req: NextRequest) {
  const key = requireKey(req);
  if (typeof key !== "string") return key;
  const serviceId = req.nextUrl.searchParams.get("service_id");
  if (serviceId && !UUID_RE.test(serviceId)) return badRequest("service_id غير صالح.");
  const { data, error } = await createAnonClient().rpc("api_specialists", { p_api_key: key, p_service_id: serviceId });
  return error ? fromDbError(error) : apiOk(data);
}
