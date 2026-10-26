"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { bookingErrorMessage, type BookingDetails } from "@/lib/booking";
import { type ActionState, optionalText, text } from "@/lib/forms";
import { createdBookingEvent, sendCustomerBookingEmail, sendSalonNewBookingEmail } from "@/lib/notifications";
import { siteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type Slot = { specialistId: string; specialistName: string; startsAt: string };

export async function fetchSlots(
  salonId: string,
  serviceId: string,
  specialistId: string | null,
  date: string,
): Promise<{ slots: Slot[] } | { error: string }> {
  if (!UUID_RE.test(salonId) || !UUID_RE.test(serviceId) || (specialistId && !UUID_RE.test(specialistId)) || !DATE_RE.test(date)) {
    return { error: "بيانات غير صالحة." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_salon_id: salonId,
    p_service_id: serviceId,
    p_specialist_id: specialistId,
    p_date: date,
  });
  if (error) return { error: "تعذّر تحميل المواعيد المتاحة." };
  return {
    slots: data.map((s) => ({ specialistId: s.specialist_id, specialistName: s.specialist_name, startsAt: s.starts_at })),
  };
}

export async function submitBooking(salonId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const serviceId = text(formData, "service_id");
  const specialistId = optionalText(formData, "specialist_id");
  const startsAt = text(formData, "starts_at");
  const fullName = text(formData, "full_name");
  const phone = text(formData, "phone");
  const email = text(formData, "email").toLowerCase();

  if (!UUID_RE.test(serviceId) || !startsAt) return { error: "اختر الخدمة والموعد أولًا." };
  if (fullName.length < 2 || !phone || !email) return { error: "الاسم ورقم الهاتف والبريد الإلكتروني مطلوبة." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_salon_id: salonId,
    p_service_id: serviceId,
    p_specialist_id: specialistId,
    p_starts_at: startsAt,
    p_full_name: fullName,
    p_phone: phone,
    p_email: email,
    p_notes: optionalText(formData, "notes"),
  });
  if (error || !data) return { error: bookingErrorMessage(error) };

  const booking = data as unknown as BookingDetails;
  const origin = await siteOrigin();

  after(async () => {
    await sendCustomerBookingEmail(createdBookingEvent(booking), booking, `${origin}/bookings/${booking.token}`);
    await sendSalonNewBookingEmail(booking.salon.email ?? null, booking, `${origin}/dashboard/${salonId}/bookings`);
  });

  redirect(`/bookings/${booking.token}?new=1`);
}
