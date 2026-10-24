"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import type { Enums } from "@/lib/database.types";
import { dbErrorMessage } from "@/lib/errors";
import type { ActionState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function setSalonStatus(salonId: string, status: Enums<"salon_status">): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("salons").update({ status }).eq("id", salonId);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return null;
}
