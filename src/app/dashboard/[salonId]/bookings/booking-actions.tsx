import { ActionForm, SubmitButton } from "@/components/action-form";
import { inputStyles } from "@/components/ui";
import type { Enums } from "@/lib/database.types";
import { cancelBookingByOwner, confirmBooking } from "../actions";

export function BookingActions({
  salonId,
  bookingId,
  status,
  canEdit,
}: {
  salonId: string;
  bookingId: string;
  status: Enums<"booking_status">;
  canEdit: boolean;
}) {
  if (status === "cancelled") return <span className="text-xs text-muted">—</span>;
  return (
    <div className="flex min-w-44 flex-col gap-2">
      {status === "pending" && canEdit && (
        <ActionForm action={confirmBooking.bind(null, salonId, bookingId)}>
          <SubmitButton className="w-full !py-1.5" pendingText="جارٍ التأكيد…">
            تأكيد
          </SubmitButton>
        </ActionForm>
      )}
      <details>
        <summary className="cursor-pointer text-xs text-red-700 hover:underline">إلغاء الحجز…</summary>
        <ActionForm
          action={cancelBookingByOwner.bind(null, salonId, bookingId)}
          confirm="إلغاء هذا الحجز؟ سيتم إبلاغ العميل وتحرير الموعد."
          className="mt-2 space-y-2"
        >
          <input name="reason" maxLength={300} placeholder="السبب (اختياري)" aria-label="سبب الإلغاء" className={`${inputStyles} !py-1.5 text-xs`} />
          <SubmitButton variant="danger" className="w-full !py-1.5" pendingText="جارٍ الإلغاء…">
            تأكيد الإلغاء
          </SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}
