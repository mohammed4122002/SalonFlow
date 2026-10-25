import type { Enums } from "@/lib/database.types";

// Shape returned by private.booking_json() (website token page and API).
export type BookingDetails = {
  id: string;
  status: Enums<"booking_status">;
  starts_at: string;
  ends_at: string;
  price: number;
  currency: string;
  timezone: string;
  notes: string | null;
  source: string;
  channel_ref: string | null;
  cancelled_at: string | null;
  created_at: string;
  can_cancel: boolean;
  salon: { id: string; name: string; slug: string; phone: string | null; address: string | null; email?: string | null };
  service: { id: string; name: string; duration_minutes: number };
  specialist: { id: string; full_name: string };
  customer: { full_name: string; phone: string; email: string };
  token?: string;
};

// Stable error keys raised by the booking functions in the database.
export const BOOKING_ERRORS = {
  SALON_UNAVAILABLE: { status: 403, message: "الصالون لا يستقبل حجوزات حاليًا." },
  SERVICE_UNAVAILABLE: { status: 422, message: "هذه الخدمة غير متاحة." },
  SLOT_UNAVAILABLE: { status: 409, message: "هذا الموعد لم يعد متاحًا، اختر موعدًا آخر." },
  TOO_MANY_PENDING: { status: 429, message: "لديك 3 حجوزات بانتظار التأكيد، انتظر تأكيدها قبل حجز المزيد." },
  INVALID_CUSTOMER: { status: 422, message: "يرجى إدخال الاسم ورقم هاتف وبريد إلكتروني صحيحين." },
  INVALID_DATE: { status: 422, message: "التاريخ غير صالح (اليوم حتى 90 يومًا قادمة)." },
  NOT_FOUND: { status: 404, message: "الحجز غير موجود." },
  NOT_CANCELLABLE: { status: 409, message: "لا يمكن إلغاء هذا الحجز (ليس بانتظار التأكيد أو أن موعده بدأ)." },
  UNAUTHORIZED: { status: 401, message: "مفتاح الربط غير صحيح أو معطّل." },
} as const;

export type BookingErrorCode = keyof typeof BOOKING_ERRORS;

export function bookingErrorCode(error: { message?: string; code?: string } | null | undefined): BookingErrorCode | null {
  const key = error?.message?.trim();
  return key && key in BOOKING_ERRORS ? (key as BookingErrorCode) : null;
}

export function bookingErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  const code = bookingErrorCode(error);
  return code ? BOOKING_ERRORS[code].message : "تعذّر إتمام الحجز، حاول مرة أخرى.";
}
