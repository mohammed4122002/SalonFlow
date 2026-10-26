"use server";

import { refresh } from "next/cache";
import { editBlockedReason, requireManagedSalon } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import type { ActionState } from "@/lib/forms";
import { MAX_GALLERY_PHOTOS, MEDIA_BUCKET } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";

export type MediaKind = "logo" | "cover" | "photo";

const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const MAX_BYTES = 3 * 1024 * 1024;

async function guard(salonId: string): Promise<string | null> {
  await requireManagedSalon(salonId);
  return editBlockedReason(salonId);
}

/** Uploads a logo, cover or gallery photo (already resized in the browser). */
export async function uploadMedia(salonId: string, kind: MediaKind, formData: FormData): Promise<ActionState> {
  const blocked = await guard(salonId);
  if (blocked) return { error: blocked };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "اختر صورة أولًا." };
  const ext = TYPES[file.type];
  if (!ext) return { error: "الصيغة غير مدعومة. استخدم JPG أو PNG أو WebP." };
  if (file.size > MAX_BYTES) return { error: "حجم الصورة أكبر من 3 ميغابايت." };

  const supabase = await createClient();
  if (kind === "photo") {
    const { count } = await supabase.from("salon_photos").select("id", { count: "exact", head: true }).eq("salon_id", salonId);
    if ((count ?? 0) >= MAX_GALLERY_PHOTOS) return { error: `الحد الأقصى ${MAX_GALLERY_PHOTOS} صورة في المعرض. احذف صورة أولًا.` };
  }

  const path = `${salonId}/${kind}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error(`[media] upload failed: ${uploadError.message}`);
    return { error: "تعذّر رفع الصورة، حاول مرة أخرى." };
  }

  if (kind === "photo") {
    const { error } = await supabase.from("salon_photos").insert({ salon_id: salonId, path, sort_order: Date.now() % 1_000_000_000 });
    if (error) {
      await supabase.storage.from(MEDIA_BUCKET).remove([path]);
      return { error: error.message.includes("PHOTO_LIMIT") ? `الحد الأقصى ${MAX_GALLERY_PHOTOS} صورة.` : dbErrorMessage(error) };
    }
  } else {
    const column = kind === "logo" ? "logo_path" : "cover_path";
    const { data: before } = await supabase.from("salons").select("logo_path, cover_path").eq("id", salonId).single();
    const patch = kind === "logo" ? { logo_path: path } : { cover_path: path };
    const { error } = await supabase.from("salons").update(patch).eq("id", salonId);
    if (error) {
      await supabase.storage.from(MEDIA_BUCKET).remove([path]);
      return { error: dbErrorMessage(error) };
    }
    const old = before?.[column];
    if (old) await supabase.storage.from(MEDIA_BUCKET).remove([old]);
  }

  refresh();
  return { success: kind === "logo" ? "تم تحديث الشعار." : kind === "cover" ? "تم تحديث صورة الغلاف." : "تمت إضافة الصورة للمعرض." };
}

export async function removeMedia(salonId: string, kind: "logo" | "cover"): Promise<ActionState> {
  const blocked = await guard(salonId);
  if (blocked) return { error: blocked };
  const column = kind === "logo" ? "logo_path" : "cover_path";
  const supabase = await createClient();
  const { data: before } = await supabase.from("salons").select("logo_path, cover_path").eq("id", salonId).single();
  const patch = kind === "logo" ? { logo_path: null } : { cover_path: null };
  const { error } = await supabase.from("salons").update(patch).eq("id", salonId);
  if (error) return { error: dbErrorMessage(error) };
  const old = before?.[column];
  if (old) await supabase.storage.from(MEDIA_BUCKET).remove([old]);
  refresh();
  return { success: kind === "logo" ? "تم حذف الشعار." : "تم حذف صورة الغلاف." };
}

export async function deletePhoto(salonId: string, photoId: string): Promise<ActionState> {
  const blocked = await guard(salonId);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { data: photo } = await supabase.from("salon_photos").select("path").eq("id", photoId).eq("salon_id", salonId).maybeSingle();
  if (!photo) return { error: "الصورة غير موجودة." };
  const { error } = await supabase.from("salon_photos").delete().eq("id", photoId).eq("salon_id", salonId);
  if (error) return { error: dbErrorMessage(error) };
  await supabase.storage.from(MEDIA_BUCKET).remove([photo.path]);
  refresh();
  return { success: "تم حذف الصورة." };
}
