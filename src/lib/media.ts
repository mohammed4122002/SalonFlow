import "server-only";
import { supabaseEnv } from "@/lib/supabase/env";

export const MEDIA_BUCKET = "salon-media";
export const MAX_GALLERY_PHOTOS = 12;

/** Public URL of a file in the salon-media bucket (paths look like "<salon_id>/<file>"). */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${supabaseEnv().url}/storage/v1/object/public/${MEDIA_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
