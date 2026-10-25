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

// ---------------------------------------------------------------- subscriptions
// Manual management until a payment gateway is integrated. Every change is
// recorded in subscription_events by a database trigger.

async function updateSubscription(
  salonId: string,
  values: { status?: Enums<"subscription_status">; plan?: string; trial_ends_at?: string; current_period_start?: string | null; current_period_end?: string | null },
): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("subscriptions").update(values).eq("salon_id", salonId);
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { success: "تم تحديث الاشتراك." };
}

export async function extendTrial(salonId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const days = Number(formData.get("days"));
  if (!Number.isInteger(days) || days < 1 || days > 365) return { error: "عدد الأيام بين 1 و365." };
  await requireAdmin();
  const supabase = await createClient();
  const { data: sub } = await supabase.from("subscriptions").select("trial_ends_at").eq("salon_id", salonId).single();
  const base = Math.max(Date.now(), sub ? new Date(sub.trial_ends_at).getTime() : 0);
  return updateSubscription(salonId, {
    status: "trialing",
    trial_ends_at: new Date(base + days * 86_400_000).toISOString(),
  });
}

export async function activateSubscription(salonId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const months = Number(formData.get("months"));
  const plan = String(formData.get("plan") ?? "").trim() || "standard";
  if (!Number.isInteger(months) || months < 1 || months > 36) return { error: "عدد الأشهر بين 1 و36." };
  if (!/^[a-z0-9_-]{2,40}$/i.test(plan)) return { error: "اسم الباقة بأحرف إنجليزية وأرقام فقط." };
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  return updateSubscription(salonId, {
    status: "active",
    plan,
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
  });
}

export async function suspendSubscription(salonId: string): Promise<ActionState> {
  return updateSubscription(salonId, { status: "suspended" });
}
