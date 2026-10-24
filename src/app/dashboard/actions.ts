"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import type { ActionState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { readSalonFields } from "./salon-fields";

export async function createSalon(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const fields = readSalonFields(formData);
  if (!fields.name || !fields.slug || !fields.timezone || !fields.currency) {
    return { error: "يرجى تعبئة الاسم والرابط والمنطقة الزمنية والعملة." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("salons")
    .insert({ ...fields, owner_id: user.id })
    .select("id")
    .single();
  if (error) return { error: dbErrorMessage(error) };

  redirect(`/dashboard/${data.id}`);
}
