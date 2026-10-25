import type { Tables } from "@/lib/database.types";

type Sub = Pick<Tables<"subscriptions">, "status" | "trial_ends_at" | "current_period_end">;

// Mirrors private.subscription_valid() in the database (the source of truth).
export function subscriptionValid(sub: Sub | null | undefined, now: Date): boolean {
  if (!sub) return false;
  if (sub.status === "trialing") return new Date(sub.trial_ends_at) > now;
  if (sub.status === "active") return !sub.current_period_end || new Date(sub.current_period_end) > now;
  return false;
}

export type SalonAccess = "operational" | "suspended_by_admin" | "subscription_expired";

export function salonAccess(salonStatus: Tables<"salons">["status"], sub: Sub | null | undefined, now: Date): SalonAccess {
  if (salonStatus !== "active") return "suspended_by_admin";
  return subscriptionValid(sub, now) ? "operational" : "subscription_expired";
}

export const ACCESS_MESSAGES: Record<Exclude<SalonAccess, "operational">, string> = {
  suspended_by_admin: "حساب الصالون معلّق من إدارة المنصة. لا يظهر للعملاء ولا يستقبل حجوزات، ولا يمكن تعديل بياناته.",
  subscription_expired:
    "انتهت الفترة التجريبية أو الاشتراك. الصالون مخفي عن العملاء ولا يستقبل حجوزات، ولا يمكن تعديل بياناته حتى تتم الترقية. ما زال بإمكانك عرض البيانات وإلغاء الحجوزات.",
};
