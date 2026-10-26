"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import type { BookingDetails } from "@/lib/booking";
import { deliverWebhook, sendCustomerBookingEmail } from "@/lib/notifications";
import { siteOrigin } from "@/lib/site-url";
import { editBlockedReason, requireManagedSalon } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import { type ActionState, checkbox, numberField, optionalText, text } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { zonedLocalToUtcIso } from "@/lib/time";
import { readSalonFields } from "../salon-fields";

// Every action re-checks that the signed-in user manages this salon, and
// scopes each query by salon_id. RLS enforces the same rules in the database.

const SAVED: ActionState = { success: "تم الحفظ." };

// ---------------------------------------------------------------- salon

export async function updateSalon(salonId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const fields = readSalonFields(formData);
  if (!fields.name || !fields.slug || !fields.timezone || !fields.currency) {
    return { error: "يرجى تعبئة الاسم والرابط والمنطقة الزمنية والعملة." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("salons").update(fields).eq("id", salonId);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return SAVED;
}

export async function setPublished(salonId: string, publish: boolean): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const supabase = await createClient();

  if (publish) {
    const [services, specialists] = await Promise.all([
      supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salonId).eq("is_active", true),
      supabase.from("specialists").select("id", { count: "exact", head: true }).eq("salon_id", salonId).eq("is_active", true),
    ]);
    if (!services.count || !specialists.count) {
      return { error: "أضف خدمة نشطة واحدة وأخصائية نشطة واحدة على الأقل قبل النشر." };
    }
  }

  const { error } = await supabase.from("salons").update({ is_published: publish }).eq("id", salonId);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { success: publish ? "تم نشر الصالون، وأصبح ظاهرًا للزوار." : "تم إخفاء الصالون عن الزوار." };
}

// ---------------------------------------------------------------- services

function readService(formData: FormData) {
  const name = text(formData, "name");
  const duration = numberField(formData, "duration_minutes");
  const price = numberField(formData, "price");
  if (name.length < 2) return { error: "اسم الخدمة مطلوب (حرفان على الأقل)." } as const;
  if (duration === null || !Number.isInteger(duration) || duration < 5 || duration > 600) {
    return { error: "المدة يجب أن تكون بين 5 و600 دقيقة." } as const;
  }
  if (price === null || price < 0) return { error: "السعر يجب أن يكون صفرًا أو أكثر." } as const;
  return {
    values: {
      name,
      description: optionalText(formData, "description"),
      duration_minutes: duration,
      price,
      is_active: checkbox(formData, "is_active"),
    },
  } as const;
}

export async function createService(salonId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const parsed = readService(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.from("services").insert({ ...parsed.values, salon_id: salonId });
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { success: "تمت إضافة الخدمة." };
}

export async function updateService(
  salonId: string,
  serviceId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const parsed = readService(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.from("services").update(parsed.values).eq("id", serviceId).eq("salon_id", salonId);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return SAVED;
}

export async function deleteService(salonId: string, serviceId: string): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", serviceId).eq("salon_id", salonId);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return null;
}

// ---------------------------------------------------------------- specialists

async function syncSpecialistServices(salonId: string, specialistId: string, selected: string[]) {
  const supabase = await createClient();
  const { data: current, error } = await supabase
    .from("specialist_services")
    .select("service_id")
    .eq("specialist_id", specialistId)
    .eq("salon_id", salonId);
  if (error) return error;

  const have = new Set(current.map((r) => r.service_id));
  const want = new Set(selected);
  const toRemove = [...have].filter((id) => !want.has(id));
  const toAdd = [...want].filter((id) => !have.has(id));

  if (toRemove.length) {
    const { error: e } = await supabase
      .from("specialist_services")
      .delete()
      .eq("specialist_id", specialistId)
      .eq("salon_id", salonId)
      .in("service_id", toRemove);
    if (e) return e;
  }
  if (toAdd.length) {
    const { error: e } = await supabase
      .from("specialist_services")
      .insert(toAdd.map((service_id) => ({ salon_id: salonId, specialist_id: specialistId, service_id })));
    if (e) return e;
  }
  return null;
}

function readSpecialist(formData: FormData) {
  return {
    full_name: text(formData, "full_name"),
    bio: optionalText(formData, "bio"),
    is_active: checkbox(formData, "is_active"),
  };
}

function selectedServices(formData: FormData): string[] {
  return formData.getAll("service_ids").filter((v): v is string => typeof v === "string");
}

export async function createSpecialist(salonId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const values = readSpecialist(formData);
  if (values.full_name.length < 2) return { error: "اسم الأخصائية مطلوب." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("specialists")
    .insert({ ...values, salon_id: salonId })
    .select("id")
    .single();
  if (error) return { error: dbErrorMessage(error) };

  const linkError = await syncSpecialistServices(salonId, data.id, selectedServices(formData));
  refresh();
  if (linkError) return { error: dbErrorMessage(linkError, "أُضيفت الأخصائية، لكن تعذّر ربط الخدمات.") };
  return { success: "تمت إضافة الأخصائية." };
}

export async function updateSpecialist(
  salonId: string,
  specialistId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const values = readSpecialist(formData);
  if (values.full_name.length < 2) return { error: "اسم الأخصائية مطلوب." };

  const supabase = await createClient();
  const { error } = await supabase.from("specialists").update(values).eq("id", specialistId).eq("salon_id", salonId);
  if (error) return { error: dbErrorMessage(error) };

  const linkError = await syncSpecialistServices(salonId, specialistId, selectedServices(formData));
  refresh();
  if (linkError) return { error: dbErrorMessage(linkError) };
  return SAVED;
}

export async function deleteSpecialist(salonId: string, specialistId: string): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { error } = await supabase.from("specialists").delete().eq("id", specialistId).eq("salon_id", salonId);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return null;
}

// ---------------------------------------------------------------- working hours & time off

export async function addWorkingHours(salonId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const days = formData
    .getAll("days")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const start = text(formData, "start_time");
  const end = text(formData, "end_time");
  const specialistId = optionalText(formData, "specialist_id");

  if (!days.length) return { error: "اختر يومًا واحدًا على الأقل." };
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return { error: "أدخل وقت البداية والنهاية." };
  if (end <= start) return { error: "وقت النهاية يجب أن يكون بعد وقت البداية." };

  const supabase = await createClient();
  const { error } = await supabase.from("working_hours").insert(
    days.map((day_of_week) => ({
      salon_id: salonId,
      specialist_id: specialistId,
      day_of_week,
      start_time: start,
      end_time: end,
    })),
  );
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { success: "تمت إضافة الفترة." };
}

export async function deleteWorkingHours(salonId: string, id: string): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { error } = await supabase.from("working_hours").delete().eq("id", id).eq("salon_id", salonId);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return null;
}

export async function addTimeOff(salonId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { salon } = await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const startsAt = zonedLocalToUtcIso(text(formData, "starts_at"), salon.timezone);
  const endsAt = zonedLocalToUtcIso(text(formData, "ends_at"), salon.timezone);
  if (!startsAt || !endsAt) return { error: "أدخل تاريخ ووقت البداية والنهاية." };
  if (endsAt <= startsAt) return { error: "نهاية الإجازة يجب أن تكون بعد بدايتها." };

  const supabase = await createClient();
  const { error } = await supabase.from("time_off").insert({
    salon_id: salonId,
    specialist_id: optionalText(formData, "specialist_id"),
    starts_at: startsAt,
    ends_at: endsAt,
    reason: optionalText(formData, "reason"),
  });
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { success: "تمت إضافة الإجازة." };
}

export async function deleteTimeOff(salonId: string, id: string): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { error } = await supabase.from("time_off").delete().eq("id", id).eq("salon_id", salonId);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return null;
}

// ---------------------------------------------------------------- bookings

async function loadBookingDetails(bookingId: string, salonId: string): Promise<BookingDetails | null> {
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select(
      "id, status, starts_at, ends_at, price, notes, source, channel_ref, cancelled_at, created_at, public_token, " +
        "customers(full_name, phone, email), services(id, name, duration_minutes), specialists(id, full_name), " +
        "salons(id, name, slug, phone, address, currency, timezone, auto_confirm_bookings)",
    )
    .eq("id", bookingId)
    .eq("salon_id", salonId)
    .maybeSingle()
    .overrideTypes<BookingRow>();
  if (!b || !b.customers || !b.services || !b.specialists || !b.salons) return null;
  return {
    id: b.id,
    status: b.status,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    price: b.price,
    currency: b.salons.currency,
    timezone: b.salons.timezone,
    notes: b.notes,
    source: b.source,
    channel_ref: b.channel_ref,
    cancelled_at: b.cancelled_at,
    created_at: b.created_at,
    can_cancel:
      new Date(b.starts_at) > new Date() &&
      (b.status === "pending" || (b.status === "confirmed" && b.salons.auto_confirm_bookings)),
    salon: { id: b.salons.id, name: b.salons.name, slug: b.salons.slug, phone: b.salons.phone, address: b.salons.address },
    service: b.services,
    specialist: b.specialists,
    customer: b.customers,
    token: b.public_token,
  };
}

type BookingRow = {
  id: string;
  status: "pending" | "confirmed" | "cancelled";
  starts_at: string;
  ends_at: string;
  price: number;
  notes: string | null;
  source: string;
  channel_ref: string | null;
  cancelled_at: string | null;
  created_at: string;
  public_token: string;
  customers: { full_name: string; phone: string; email: string } | null;
  services: { id: string; name: string; duration_minutes: number } | null;
  specialists: { id: string; full_name: string } | null;
  salons: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    address: string | null;
    currency: string;
    timezone: string;
    auto_confirm_bookings: boolean;
  } | null;
};

// Email the customer and notify the salon's n8n workflow, after the response.
async function notifyStatusChange(salonId: string, booking: BookingDetails, event: "confirmed" | "cancelled") {
  const origin = await siteOrigin();
  const supabase = await createClient();
  const { data: integration } = await supabase
    .from("salon_integrations")
    .select("enabled, webhook_url, webhook_secret")
    .eq("salon_id", salonId)
    .maybeSingle();

  after(async () => {
    await sendCustomerBookingEmail(event, booking, `${origin}/bookings/${booking.token}`);
    if (integration?.enabled && integration.webhook_url) {
      const { token: _token, ...publicBooking } = booking;
      void _token;
      const result = await deliverWebhook(
        { url: integration.webhook_url, secret: integration.webhook_secret },
        `booking.${event}`,
        publicBooking,
      );
      await supabase
        .from("salon_integrations")
        .update({ last_webhook_at: new Date().toISOString(), last_webhook_status: `booking.${event}: ${result.status}` })
        .eq("salon_id", salonId);
    }
  });
}

export async function confirmBooking(salonId: string, bookingId: string): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", bookingId)
    .eq("salon_id", salonId)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data.length) return { error: "لا يمكن تأكيد هذا الحجز (ربما أُلغي أو تم تأكيده)." };

  const booking = await loadBookingDetails(bookingId, salonId);
  if (booking) await notifyStatusChange(salonId, booking, "confirmed");
  refresh();
  return { success: "تم تأكيد الحجز وإبلاغ العميل." };
}

export async function cancelBookingByOwner(
  salonId: string,
  bookingId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Allowed even when the account is suspended, so customers can be informed.
  await requireManagedSalon(salonId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancellation_reason: optionalText(formData, "reason") ?? "ألغاه الصالون" })
    .eq("id", bookingId)
    .eq("salon_id", salonId)
    .neq("status", "cancelled")
    .select("id");
  if (error) return { error: dbErrorMessage(error) };
  if (!data.length) return { error: "هذا الحجز ملغي مسبقًا." };

  const booking = await loadBookingDetails(bookingId, salonId);
  if (booking) await notifyStatusChange(salonId, booking, "cancelled");
  refresh();
  return { success: "تم إلغاء الحجز وتحرير الموعد وإبلاغ العميل." };
}
