import Link from "next/link";
import { Suspense } from "react";
import { Badge, Skeleton } from "@/components/ui";
import { requireManagedSalon } from "@/lib/auth";
import { SALON_STATUS_LABELS } from "@/lib/format";
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
  const { salon } = await requireManagedSalon(salonId);

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
      <SalonTabs salonId={salon.id} />
    </div>
  );
}
