import type { NextRequest } from "next/server";
import { UUID_RE, apiOk, badRequest, fromDbError, requireKey } from "@/lib/api";
import { createAnonClient } from "@/lib/supabase/anon";

// Booking status and details (only bookings of the key's salon).
export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/bookings/[id]">) {
  const key = requireKey(req);
  if (typeof key !== "string") return key;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return badRequest("معرّف الحجز غير صالح.");
  const { data, error } = await createAnonClient().rpc("api_get_booking", { p_api_key: key, p_booking_id: id });
  return error ? fromDbError(error) : apiOk(data);
}
