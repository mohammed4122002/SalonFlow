import { after, type NextRequest } from "next/server";
import { UUID_RE, apiOk, badRequest, fromDbError, requireKey } from "@/lib/api";
import type { BookingDetails } from "@/lib/booking";
import { sendCustomerBookingEmail } from "@/lib/notifications";
import { createAnonClient } from "@/lib/supabase/anon";

// Customer-initiated cancellation of a pending, future booking.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/v1/bookings/[id]/cancel">) {
  const key = requireKey(req);
  if (typeof key !== "string") return key;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return badRequest("معرّف الحجز غير صالح.");
  const { data, error } = await createAnonClient().rpc("api_cancel_booking", { p_api_key: key, p_booking_id: id });
  if (error) return fromDbError(error);
  const booking = data as unknown as BookingDetails;
  after(() => sendCustomerBookingEmail("cancelled", booking, null).then(() => undefined));
  return apiOk(booking);
}
