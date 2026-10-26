"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import type { BookingDetails } from "@/lib/booking";
import type { ActionState } from "@/lib/forms";
import { sendCustomerBookingEmail } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export async function cancelByToken(token: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: before } = await supabase.rpc("get_booking_by_token", { p_token: token });
  const { data, error } = await supabase.rpc("cancel_booking_by_token", { p_token: token });
  if (error || !data) return { error: "تعذّر إلغاء الحجز." };

  const booking = data as unknown as BookingDetails;
  const wasActive = (before as unknown as BookingDetails | null)?.status !== "cancelled";
  if (booking.status !== "cancelled") {
    return { error: "لا يمكن إلغاء هذا الحجز من هنا. تواصلي مع الصالون مباشرة." };
  }
  if (wasActive) after(() => sendCustomerBookingEmail("cancelled", booking, null).then(() => undefined));
  refresh();
  return { success: "تم إلغاء الحجز، وأصبح الموعد متاحًا." };
}
