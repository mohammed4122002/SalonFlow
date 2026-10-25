import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import type { Enums } from "@/lib/database.types";
import { requireManagedSalon } from "@/lib/auth";
import { BOOKING_STATUS_LABELS, formatDateTime, formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { BookingActions } from "./booking-actions";

export const metadata: Metadata = { title: "الحجوزات" };

const STATUS_TONE = { pending: "amber", confirmed: "green", cancelled: "neutral" } as const;
const STATUSES = Object.keys(BOOKING_STATUS_LABELS) as Enums<"booking_status">[];

type Props = PageProps<"/dashboard/[salonId]/bookings">;

export default function BookingsPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Bookings params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Bookings({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { salonId } = await params;
  const sp = await searchParams;
  const { salon, canEdit } = await requireManagedSalon(salonId);
  await connection();

  const status = STATUSES.find((s) => s === sp.status);
  const past = sp.when === "past";
  const now = new Date().toISOString();

  const supabase = await createClient();
  let query = supabase
    .from("bookings")
    .select(
      "id, starts_at, ends_at, status, price, notes, source, customers(full_name, phone, email), services(name), specialists(full_name)",
    )
    .eq("salon_id", salonId)
    .limit(200);
  query = past ? query.lt("starts_at", now).order("starts_at", { ascending: false }) : query.gte("starts_at", now).order("starts_at");
  if (status) query = query.eq("status", status);
  const { data: bookings, error } = await query;
  if (error) throw error;

  const base = `/dashboard/${salonId}/bookings`;
  const link = (next: { status?: string; when?: string }) => {
    const q = new URLSearchParams();
    const s = "status" in next ? next.status : status;
    const w = "when" in next ? next.when : past ? "past" : undefined;
    if (s) q.set("status", s);
    if (w) q.set("when", w);
    const str = q.toString();
    return str ? `${base}?${str}` : base;
  };
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-surface text-muted hover:text-ink"}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={link({ when: undefined })} className={chip(!past)}>
          القادمة
        </Link>
        <Link href={link({ when: "past" })} className={chip(past)}>
          السابقة
        </Link>
        <span className="mx-1 w-px bg-line" aria-hidden />
        <Link href={link({ status: undefined })} className={chip(!status)}>
          الكل
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={link({ status: s })} className={chip(status === s)}>
            {BOOKING_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <EmptyState title="لا توجد حجوزات" description="ستظهر هنا حجوزات العملاء حسب الفلتر المختار." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-canvas text-start text-xs text-muted">
              <tr>
                <th className="p-3 text-start font-medium">الموعد</th>
                <th className="p-3 text-start font-medium">العميل</th>
                <th className="p-3 text-start font-medium">الخدمة</th>
                <th className="p-3 text-start font-medium">الأخصائية</th>
                <th className="p-3 text-start font-medium">السعر</th>
                <th className="p-3 text-start font-medium">الحالة</th>
                <th className="p-3 text-start font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bookings.map((b) => (
                <tr key={b.id} className="align-top">
                  <td className="p-3 whitespace-nowrap">{formatDateTime(b.starts_at, salon.timezone)}</td>
                  <td className="p-3">
                    <p className="font-medium">{b.customers?.full_name}</p>
                    <p className="ltr text-start text-xs text-muted">{b.customers?.phone}</p>
                    <p className="ltr text-start text-xs text-muted">{b.customers?.email}</p>
                    {b.notes && <p className="mt-1 max-w-48 text-xs text-muted">«{b.notes}»</p>}
                  </td>
                  <td className="p-3">{b.services?.name}</td>
                  <td className="p-3">{b.specialists?.full_name}</td>
                  <td className="p-3 whitespace-nowrap">{formatPrice(b.price, salon.currency)}</td>
                  <td className="p-3">
                    <Badge tone={STATUS_TONE[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                    {b.source === "api" && (
                      <span className="mt-1 block text-xs text-muted">عبر البوت</span>
                    )}
                  </td>
                  <td className="p-3">
                    <BookingActions salonId={salonId} bookingId={b.id} status={b.status} canEdit={canEdit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
