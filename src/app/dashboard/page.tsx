import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Badge,
  EmptyState,
  PageHeader,
  Skeleton,
  buttonStyles,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { SALON_STATUS_LABELS } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { SalonCover, SalonLogo } from "@/components/salon-visuals";
import { mediaUrl } from "@/lib/media";

export const metadata: Metadata = { title: "لوحة التحكم" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="صالوناتي"
        description="اختر صالونًا لإدارة خدماته وأخصائياته وأوقات عمله وحجوزاته."
        actions={
          <Link href="/dashboard/new" className={buttonStyles.primary}>
            + صالون جديد
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-40" />}>
        <SalonList />
      </Suspense>
    </>
  );
}

async function SalonList() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: salons, error } = await supabase
    .from("salons")
    .select("id, name, slug, city, status, is_published, logo_path, cover_path")
    .eq("owner_id", user.id)
    .order("created_at");
  if (error) throw error;

  if (!salons.length) {
    return (
      <EmptyState
        title={`أهلًا ${user.fullName || ""}! لنبدأ بإنشاء صالونك`}
        description="أضف بيانات الصالون، ثم الخدمات والأخصائيات وساعات العمل، وبعدها انشره ليظهر للعملاء."
        action={
          <Link href="/dashboard/new" className={buttonStyles.primary}>
            إنشاء صالون
          </Link>
        }
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {salons.map((salon) => (
        <li key={salon.id}>
          <Link
            href={`/dashboard/${salon.id}`}
            className="group block overflow-hidden rounded-3xl border border-line/80 bg-surface shadow-soft transition duration-500 hover:-translate-y-1 hover:shadow-lift"
          >
            <div className="relative h-28 overflow-hidden">
              <SalonCover
                src={mediaUrl(salon.cover_path)}
                name={salon.name}
                sizes="(min-width: 1024px) 360px, 100vw"
                className="transition duration-700 group-hover:scale-105"
              />
            </div>
            <div className="px-5 pb-5">
              <div className="-mt-7 flex items-end gap-3">
                <SalonLogo
                  src={mediaUrl(salon.logo_path)}
                  name={salon.name}
                  className="size-14 text-xl"
                />
                <p className="pb-1 font-display text-lg font-bold">
                  {salon.name}
                </p>
              </div>
              <p className="ltr mt-2 text-start text-xs text-muted">
                /salons/{salon.slug}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone={salon.status === "active" ? "green" : "red"}>
                  {SALON_STATUS_LABELS[salon.status]}
                </Badge>
                <Badge tone={salon.is_published ? "brand" : "neutral"}>
                  {salon.is_published ? "منشور" : "غير منشور"}
                </Badge>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
