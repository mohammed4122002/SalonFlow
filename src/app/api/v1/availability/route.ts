import type { NextRequest } from "next/server";
import { DATE_RE, UUID_RE, apiOk, badRequest, fromDbError, requireKey } from "@/lib/api";
import { createAnonClient } from "@/lib/supabase/anon";

// Free slots: ?service_id=&date=YYYY-MM-DD[&specialist_id=]
// Each slot has starts_at (ISO, UTC) — send it back unchanged when booking —
// and local_time (HH:MM in the salon's timezone) for display.
export async function GET(req: NextRequest) {
  const key = requireKey(req);
  if (typeof key !== "string") return key;
  const sp = req.nextUrl.searchParams;
  const serviceId = sp.get("service_id");
  const date = sp.get("date");
  const specialistId = sp.get("specialist_id");
  if (!serviceId || !UUID_RE.test(serviceId)) return badRequest("service_id مطلوب.");
  if (!date || !DATE_RE.test(date)) return badRequest("date مطلوب بصيغة YYYY-MM-DD.");
  if (specialistId && !UUID_RE.test(specialistId)) return badRequest("specialist_id غير صالح.");
  const { data, error } = await createAnonClient().rpc("api_availability", {
    p_api_key: key,
    p_service_id: serviceId,
    p_date: date,
    p_specialist_id: specialistId,
  });
  return error ? fromDbError(error) : apiOk(data);
}
