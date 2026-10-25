import Link from "next/link";
import { Suspense } from "react";
import { Badge, Skeleton } from "@/components/ui";
import { requireManagedSalon } from "@/lib/auth";
import { SALON_STATUS_LABELS } from "@/lib/format";
import { ACCESS_MESSAGES } from "@/lib/subscription";
import { SalonTabs } from "./salon-tabs";

export default function SalonLayout({ children, params }: LayoutProps<"/dashboard/[salonId]">) {
  return (
    <>
      <Suspense fallback={<Skeleton className="mb-6 h-24" />}>
        <SalonHeader params={params} />
      </Suspense>
      {children}
    </>
  );
}

async function SalonHeader({ params }: { params: LayoutProps<"/dashboard/[salonId]">["params"] }) {
  const { salonId } = await params;
  const { salon, access } = await requireManagedSalon(salonId);

  return (
    <div className="mb-6">
      <Link href="/dashboard" className="text-sm text-muted hover:text-brand-700">
        → صالوناتي
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{salon.name}</h1>
        <Badge tone={salon.status === "active" ? "green" : "red"}>{SALON_STATUS_LABELS[salon.status]}</Badge>
        <Badge tone={salon.is_published ? "brand" : "neutral"}>{salon.is_published ? "منشور" : "غير منشور"}</Badge>
      </div>
      {access !== "operational" && (
        <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {ACCESS_MESSAGES[access]}{" "}
          <Link href={`/dashboard/${salon.id}/subscription`} className="font-semibold underline">
            تفاصيل الاشتراك
          </Link>
        </div>
      )}
      <SalonTabs salonId={salon.id} />
    </div>
  );
}
