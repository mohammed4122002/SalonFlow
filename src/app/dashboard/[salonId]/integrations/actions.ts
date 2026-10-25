"use server";

import { refresh } from "next/cache";
import { editBlockedReason, requireManagedSalon } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/errors";
import { type ActionState, checkbox, optionalText } from "@/lib/forms";
import { deliverWebhook } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export type KeyState = { error?: string; key?: string } | null;

/** Creates (or replaces) the salon's API key. The plaintext is returned once. */
export async function generateApiKey(salonId: string): Promise<KeyState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rotate_integration_key", { p_salon_id: salonId });
  if (error || !data) return { error: dbErrorMessage(error) };
  refresh();
  return { key: data };
}

export async function saveIntegrationSettings(salonId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };

  const webhookUrl = optionalText(formData, "webhook_url");
  const botUsername = optionalText(formData, "telegram_bot_username")?.replace(/^@/, "") ?? null;
  if (webhookUrl && !/^https:\/\/\S+$/.test(webhookUrl)) return { error: "رابط Webhook يجب أن يبدأ بـ https://" };
  if (botUsername && !/^[A-Za-z0-9_]{5,64}$/.test(botUsername)) return { error: "اسم مستخدم البوت غير صحيح (أحرف إنجليزية وأرقام و _ فقط)." };

  const settings = { enabled: checkbox(formData, "enabled"), webhook_url: webhookUrl, telegram_bot_username: botUsername };
  const supabase = await createClient();
  // Update first; insert when the salon has no integration row yet. (An upsert
  // would also try to update salon_id, which owners may not change.)
  const { data: updated, error } = await supabase
    .from("salon_integrations")
    .update(settings)
    .eq("salon_id", salonId)
    .select("salon_id");
  if (error) return { error: dbErrorMessage(error) };
  if (!updated.length) {
    const { error: insertError } = await supabase.from("salon_integrations").insert({ salon_id: salonId, ...settings });
    if (insertError) return { error: dbErrorMessage(insertError) };
  }
  refresh();
  return { success: "تم حفظ إعدادات الربط." };
}

export async function rotateWebhookSecret(salonId: string): Promise<ActionState> {
  await requireManagedSalon(salonId);
  const blocked = await editBlockedReason(salonId);
  if (blocked) return { error: blocked };
  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_webhook_secret", { p_salon_id: salonId });
  if (error) return { error: dbErrorMessage(error) };
  refresh();
  return { success: "تم توليد سر جديد. حدّثه في n8n." };
}

export async function sendTestWebhook(salonId: string): Promise<ActionState> {
  const { salon } = await requireManagedSalon(salonId);
  const supabase = await createClient();
  const { data: integration } = await supabase
    .from("salon_integrations")
    .select("webhook_url, webhook_secret")
    .eq("salon_id", salonId)
    .maybeSingle();
  if (!integration?.webhook_url) return { error: "أضف رابط Webhook واحفظ الإعدادات أولًا." };

  const result = await deliverWebhook(
    { url: integration.webhook_url, secret: integration.webhook_secret },
    "test",
    { salon: { id: salon.id, name: salon.name }, message: "رسالة تجريبية من SalonFlow" },
  );
  await supabase
    .from("salon_integrations")
    .update({ last_webhook_at: new Date().toISOString(), last_webhook_status: `test: ${result.status}` })
    .eq("salon_id", salonId);
  refresh();
  return result.ok ? { success: `وصلت الرسالة التجريبية (${result.status}).` } : { error: `فشل الإرسال: ${result.status}` };
}
