import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { SalonCover, SalonLogo } from "@/components/salon-visuals";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import { requireManagedSalon } from "@/lib/auth";
import { MAX_GALLERY_PHOTOS, mediaUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import { deletePhoto, removeMedia, uploadMedia } from "./actions";
import { ImageUploader } from "./image-uploader";

export const metadata: Metadata = { title: "صور الصالون" };

export default function MediaPage({ params }: PageProps<"/dashboard/[salonId]/media">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Media params={params} />
    </Suspense>
  );
}

async function Media({ params }: { params: PageProps<"/dashboard/[salonId]/media">["params"] }) {
  const { salonId } = await params;
  const { salon, canEdit } = await requireManagedSalon(salonId);
  const supabase = await createClient();
  const [{ data: media }, { data: photos }] = await Promise.all([
    supabase.from("salons").select("logo_path, cover_path").eq("id", salonId).single(),
    supabase.from("salon_photos").select("id, path").eq("salon_id", salonId).order("sort_order").order("created_at"),
  ]);
  const logo = mediaUrl(media?.logo_path);
  const cover = mediaUrl(media?.cover_path);
  const gallery = photos ?? [];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
        <div className="relative h-44 sm:h-56">
          <SalonCover src={cover} name={salon.name} sizes="(min-width: 1024px) 1024px, 100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-4 right-4 flex items-end gap-3">
            <SalonLogo src={logo} name={salon.name} className="size-20 text-3xl" />
            <p className="pb-1 font-display text-2xl font-bold text-white drop-shadow">{salon.name}</p>
          </div>
        </div>
        <div className="grid gap-6 p-5 sm:grid-cols-2">
          <div>
            <h2 className="font-bold">صورة الغلاف</h2>
            <p className="mb-3 text-xs text-muted">تظهر أعلى صفحة الصالون وفي بطاقته بالصفحة الرئيسية. يُفضّل صورة أفقية واضحة.</p>
            <div className="flex flex-wrap items-start gap-2">
              <ImageUploader action={uploadMedia.bind(null, salonId, "cover")} label={cover ? "تغيير الغلاف" : "رفع صورة غلاف"} disabled={!canEdit} />
              {cover && (
                <ActionForm action={removeMedia.bind(null, salonId, "cover")} confirm="حذف صورة الغلاف؟">
                  <SubmitButton variant="ghost" pendingText="…" disabled={!canEdit}>
                    حذف
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
          </div>
          <div>
            <h2 className="font-bold">الشعار</h2>
            <p className="mb-3 text-xs text-muted">صورة مربعة (مثل شعار الصالون). تظهر بجانب اسم الصالون.</p>
            <div className="flex flex-wrap items-start gap-2">
              <ImageUploader action={uploadMedia.bind(null, salonId, "logo")} label={logo ? "تغيير الشعار" : "رفع شعار"} maxSide={512} disabled={!canEdit} />
              {logo && (
                <ActionForm action={removeMedia.bind(null, salonId, "logo")} confirm="حذف الشعار؟">
                  <SubmitButton variant="ghost" pendingText="…" disabled={!canEdit}>
                    حذف
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold">معرض الصور</h2>
            <p className="text-xs text-muted">
              صور الصالون وأعمالكم ({gallery.length}/{MAX_GALLERY_PHOTOS}). تُعرض للعملاء في صفحة الصالون.
            </p>
          </div>
          <ImageUploader
            action={uploadMedia.bind(null, salonId, "photo")}
            label="إضافة صورة"
            disabled={!canEdit || gallery.length >= MAX_GALLERY_PHOTOS}
          />
        </div>
        {gallery.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.map((photo) => (
              <li key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl bg-canvas">
                <Image src={mediaUrl(photo.path)!} alt="صورة من معرض الصالون" fill sizes="(min-width: 1024px) 240px, 45vw" className="object-cover" />
                <ActionForm
                  action={deletePhoto.bind(null, salonId, photo.id)}
                  confirm="حذف هذه الصورة من المعرض؟"
                  className="absolute left-2 top-2"
                >
                  <SubmitButton variant="danger" pendingText="…" className="!px-2.5 !py-1 text-xs" disabled={!canEdit}>
                    حذف
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="لا توجد صور بعد" description="أضف صورًا للصالون وأعمالكم لتظهر للعملاء." />
        )}
      </Card>
    </div>
  );
}
