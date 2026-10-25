import { after, type NextRequest } from "next/server";
import { UUID_RE, apiOk, badRequest, fromDbError, requireKey } from "@/lib/api";
import type { BookingDetails } from "@/lib/booking";
import { sendCustomerBookingEmail, sendSalonNewBookingEmail } from "@/lib/notifications";
import { siteOrigin } from "@/lib/site-url";
import { createAnonClient } from "@/lib/supabase/anon";

type Body = {
  service_id?: unknown;
  specialist_id?: unknown;
  starts_at?: unknown;
  customer?: { full_name?: unknown; phone?: unknown; email?: unknown };
  notes?: unknown;
  channel_ref?: unknown;
  idempotency_key?: unknown;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Creates a booking request (status "pending"). Send an Idempotency-Key
// header (or idempotency_key) so retries never create duplicates.
export async function POST(req: NextRequest) {
  const key = requireKey(req);
  if (typeof key !== "string") return key;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest("جسم الطلب يجب أن يكون JSON.");
  }
  const serviceId = str(body.service_id);
  const specialistId = str(body.specialist_id) || null;
  const startsAt = str(body.starts_at);
  const idem = req.headers.get("idempotency-key")?.trim() || str(body.idempotency_key) || null;

  if (!UUID_RE.test(serviceId)) return badRequest("service_id مطلوب.");
  if (specialistId && !UUID_RE.test(specialistId)) return badRequest("specialist_id غير صالح.");
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) return badRequest("starts_at مطلوب (من نتائج availability).");
  if (idem && (idem.length < 8 || idem.length > 120)) return badRequest("Idempotency-Key بين 8 و120 حرفًا.");

  const { data, error } = await createAnonClient().rpc("api_create_booking", {
    p_api_key: key,
    p_service_id: serviceId,
    p_specialist_id: specialistId,
    p_starts_at: startsAt,
    p_full_name: str(body.customer?.full_name),
    p_phone: str(body.customer?.phone),
    p_email: str(body.customer?.email),
    p_notes: str(body.notes) || null,
    p_channel_ref: str(body.channel_ref).slice(0, 200) || null,
    p_idempotency_key: idem,
  });
  if (error) return fromDbError(error);

  const booking = data as unknown as BookingDetails & { idempotent_replay: boolean };
  if (!booking.idempotent_replay) {
    const origin = await siteOrigin();
    after(async () => {
      await sendCustomerBookingEmail("received", booking, null);
      await sendSalonNewBookingEmail(booking.salon.email ?? null, booking, `${origin}/dashboard/${booking.salon.id}/bookings`);
    });
  }
  return apiOk(booking, booking.idempotent_replay ? 200 : 201);
}
