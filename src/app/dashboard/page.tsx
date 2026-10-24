import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, EmptyState, PageHeader, Skeleton, buttonStyles } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { SALON_STATUS_LABELS } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, name, slug, city, status, is_published")
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
            className="block rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md"
          >
            <p className="font-bold">{salon.name}</p>
            <p className="ltr mt-0.5 text-start text-xs text-muted">/salons/{salon.slug}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone={salon.status === "active" ? "green" : "red"}>{SALON_STATUS_LABELS[salon.status]}</Badge>
              <Badge tone={salon.is_published ? "brand" : "neutral"}>{salon.is_published ? "منشور" : "غير منشور"}</Badge>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
