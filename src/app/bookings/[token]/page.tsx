import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Skeleton, buttonStyles } from "@/components/ui";
import type { BookingDetails } from "@/lib/booking";
import { BOOKING_STATUS_LABELS, formatDateTime, formatDuration, formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cancelByToken } from "./actions";

export const metadata: Metadata = { title: "حجزي", robots: { index: false, follow: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TONE = { pending: "amber", confirmed: "green", cancelled: "neutral" } as const;

export default function BookingPage({ params, searchParams }: PageProps<"/bookings/[token]">) {
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <BookingStatus params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function BookingStatus({
  params,
  searchParams,
}: Pick<PageProps<"/bookings/[token]">, "params" | "searchParams">) {
  const { token } = await params;
  const isNew = (await searchParams).new === "1";
  if (!UUID_RE.test(token)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_booking_by_token", { p_token: token });
  if (!data) notFound();
  const b = data as unknown as BookingDetails;

  return (
    <>
      {isNew && b.status === "pending" && (
        <p role="status" className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          تم إرسال طلب الحجز بنجاح. سيصلك بريد عند تأكيد الصالون للموعد. احتفظي برابط هذه الصفحة لمتابعة الحجز.
        </p>
      )}
      {isNew && b.status === "confirmed" && (
        <p role="status" className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          تم تأكيد حجزك بنجاح. احتفظي برابط هذه الصفحة لمتابعة الحجز أو إلغائه.
        </p>
      )}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">حجز في</p>
            <h1 className="text-xl font-bold">{b.salon.name}</h1>
          </div>
          <Badge tone={TONE[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
        </div>
        <dl className="mt-5 space-y-2.5 text-sm">
          <Row label="الخدمة" value={`${b.service.name} (${formatDuration(b.service.duration_minutes)})`} />
          <Row label="الأخصائية" value={b.specialist.full_name} />
          <Row label="الموعد" value={formatDateTime(b.starts_at, b.timezone)} />
          <Row label="السعر" value={formatPrice(b.price, b.currency)} />
          <Row label="باسم" value={b.customer.full_name} />
          {b.salon.address && <Row label="العنوان" value={b.salon.address} />}
          {b.salon.phone && <Row label="هاتف الصالون" value={b.salon.phone} ltr />}
        </dl>

        {b.can_cancel && (
          <ActionForm
            action={cancelByToken.bind(null, token)}
            confirm="هل تريدين إلغاء هذا الحجز؟"
            className="mt-6 border-t border-line pt-4"
          >
            <SubmitButton variant="danger" pendingText="جارٍ الإلغاء…">
              إلغاء الحجز
            </SubmitButton>
            <p className="mt-2 text-xs text-muted">يمكن إلغاء الحجز قبل موعده، فيصبح الموعد متاحًا لغيرك.</p>
          </ActionForm>
        )}
        {b.status === "confirmed" && !b.can_cancel && (
          <p className="mt-6 border-t border-line pt-4 text-sm text-muted">
            الحجز مؤكد. لإلغائه أو تعديله تواصلي مع الصالون مباشرة.
          </p>
        )}
      </Card>
      <Link href={`/salons/${b.salon.slug}`} className={`${buttonStyles.ghost} mt-4`}>
        → العودة لصفحة الصالون
      </Link>
    </>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-end font-medium ${ltr ? "ltr" : ""}`}>{value}</dd>
    </div>
  );
}
