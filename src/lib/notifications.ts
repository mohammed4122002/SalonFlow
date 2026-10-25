import "server-only";
import { createHmac } from "node:crypto";
import type { BookingDetails } from "@/lib/booking";
import { BOOKING_STATUS_LABELS, formatDateTime, formatPrice } from "@/lib/format";

// ---------------------------------------------------------------------------
// Email. Sent through Resend's HTTP API when RESEND_API_KEY and EMAIL_FROM are
// configured; otherwise skipped (and logged without personal data).
// ---------------------------------------------------------------------------

type EmailResult = { sent: boolean; reason?: string };

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain ?? ""}`;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.info(`[email] skipped (not configured): "${subject}" → ${maskEmail(to)}`);
    return { sent: false, reason: "not_configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[email] failed (${res.status}): "${subject}" → ${maskEmail(to)}`);
      return { sent: false, reason: `http_${res.status}` };
    }
    console.info(`[email] sent: "${subject}" → ${maskEmail(to)}`);
    return { sent: true };
  } catch (e) {
    console.error(`[email] error: "${subject}" → ${maskEmail(to)}`, e instanceof Error ? e.message : e);
    return { sent: false, reason: "network" };
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#faf8fb;font-family:Tahoma,Arial,sans-serif;color:#1f1a24">
<div style="max-width:520px;margin:24px auto;background:#fff;border:1px solid #ebe6ee;border-radius:16px;padding:24px">
<p style="margin:0 0 8px;color:#a83565;font-weight:bold">SalonFlow</p>
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${body}
<p style="margin-top:24px;font-size:12px;color:#6b6474">هذه رسالة آلية، لا ترد عليها.</p></div></body></html>`;
}

function details(b: BookingDetails): string {
  const rows: [string, string][] = [
    ["الصالون", b.salon.name],
    ["الخدمة", b.service.name],
    ["الأخصائية", b.specialist.full_name],
    ["الموعد", formatDateTime(b.starts_at, b.timezone)],
    ["السعر", formatPrice(b.price, b.currency)],
    ["الحالة", BOOKING_STATUS_LABELS[b.status]],
  ];
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#6b6474">${k}</td><td style="padding:6px 0;font-weight:bold">${escapeHtml(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

function button(href: string, label: string): string {
  return `<p style="margin-top:20px"><a href="${escapeHtml(href)}" style="background:#a83565;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;display:inline-block">${label}</a></p>`;
}

export type BookingEmailEvent = "received" | "confirmed" | "cancelled";

/** Email to the customer about their booking. `manageUrl` links to the token page. */
export function sendCustomerBookingEmail(event: BookingEmailEvent, b: BookingDetails, manageUrl: string | null) {
  const titles: Record<BookingEmailEvent, string> = {
    received: "استلمنا طلب حجزك",
    confirmed: "تم تأكيد حجزك",
    cancelled: "تم إلغاء حجزك",
  };
  const intro: Record<BookingEmailEvent, string> = {
    received: `مرحبًا ${escapeHtml(b.customer.full_name)}، طلبك بانتظار تأكيد الصالون وسنرسل لك رسالة عند التأكيد.`,
    confirmed: `مرحبًا ${escapeHtml(b.customer.full_name)}، أكّد الصالون موعدك. ننتظرك!`,
    cancelled: `مرحبًا ${escapeHtml(b.customer.full_name)}، تم إلغاء هذا الحجز وأصبح الموعد متاحًا لغيرك.`,
  };
  const body =
    `<p>${intro[event]}</p>${details(b)}` +
    (manageUrl && event !== "cancelled" ? button(manageUrl, "عرض الحجز أو إلغاؤه") : "");
  return sendEmail(b.customer.email, `${titles[event]} — ${b.salon.name}`, layout(titles[event], body));
}

/** Email to the salon (its contact address) about a new booking request. */
export function sendSalonNewBookingEmail(salonEmail: string | null, b: BookingDetails, dashboardUrl: string) {
  if (!salonEmail) return Promise.resolve({ sent: false, reason: "no_salon_email" });
  const body =
    `<p>طلب حجز جديد من <b>${escapeHtml(b.customer.full_name)}</b> (${escapeHtml(b.customer.phone)}).</p>${details(b)}` +
    button(dashboardUrl, "تأكيد أو إلغاء الحجز");
  return sendEmail(salonEmail, `حجز جديد بانتظار التأكيد — ${b.service.name}`, layout("حجز جديد بانتظار التأكيد", body));
}

// ---------------------------------------------------------------------------
// Outbound webhook to the salon's own n8n workflow, signed with its secret:
//   X-SalonFlow-Signature: sha256=<hex HMAC of the raw body>
// ---------------------------------------------------------------------------

export type WebhookTarget = { url: string; secret: string };

function isSafeWebhookUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    // Reject IP literals in private / loopback / link-local ranges.
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host.startsWith("[")) return false;
    return true;
  } catch {
    return false;
  }
}

export function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export async function deliverWebhook(
  target: WebhookTarget,
  event: string,
  data: unknown,
): Promise<{ ok: boolean; status: string }> {
  if (!isSafeWebhookUrl(target.url)) return { ok: false, status: "رابط غير مسموح (يجب أن يكون https عامًا)" };
  const body = JSON.stringify({ event, sent_at: new Date().toISOString(), data });
  try {
    const res = await fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SalonFlow-Event": event,
        "X-SalonFlow-Signature": signPayload(target.secret, body),
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    return { ok: res.ok, status: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: e instanceof Error && e.name === "TimeoutError" ? "انتهت المهلة" : "تعذّر الاتصال" };
  }
}
