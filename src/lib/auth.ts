import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/database.types";
import { ACCESS_MESSAGES, type SalonAccess, salonAccess } from "@/lib/subscription";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: Enums<"app_role">;
};

// Data Access Layer: the single place that resolves who is signed in.
// getClaims() verifies the JWT, so the result can be trusted for authorization.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email ?? "",
    fullName: profile.full_name,
    role: profile.role,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "super_admin") notFound();
  return user;
}

export type ManagedSalon = {
  user: CurrentUser;
  salon: Tables<"salons">;
  subscription: Tables<"subscriptions"> | null;
  /** Whether the salon may be changed (admins always may). */
  access: SalonAccess;
  canEdit: boolean;
};

// Published salons are readable by everyone under RLS, so ownership must be
// checked explicitly before showing management screens.
export const requireManagedSalon = cache(async (salonId: string): Promise<ManagedSalon> => {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: salon }, { data: subscription }] = await Promise.all([
    supabase.from("salons").select("*").eq("id", salonId).maybeSingle(),
    supabase.from("subscriptions").select("*").eq("salon_id", salonId).maybeSingle(),
  ]);
  if (!salon || (salon.owner_id !== user.id && user.role !== "super_admin")) notFound();
  const access = salonAccess(salon.status, subscription, new Date());
  return { user, salon, subscription, access, canEdit: access === "operational" || user.role === "super_admin" };
});

/** For Server Actions that change salon data: returns an error message when blocked. */
export async function editBlockedReason(salonId: string): Promise<string | null> {
  const { canEdit, access } = await requireManagedSalon(salonId);
  return canEdit || access === "operational" ? null : ACCESS_MESSAGES[access];
}
