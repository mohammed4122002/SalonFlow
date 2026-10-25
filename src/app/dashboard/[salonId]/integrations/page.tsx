import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Field, Skeleton, inputStyles } from "@/components/ui";
import { requireManagedSalon } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { siteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { rotateWebhookSecret, saveIntegrationSettings, sendTestWebhook } from "./actions";
import { CopyButton, KeyPanel } from "./key-panel";

export const metadata: Metadata = { title: "الربط مع n8n" };

const ENDPOINTS = [
  { method: "GET", path: "/ping", desc: "اختبار الاتصال: يعيد اسم الصالون إذا كان المفتاح صحيحًا." },
  { method: "GET", path: "/salon", desc: "بيانات الصالون وساعات العمل الأسبوعية." },
  { method: "GET", path: "/services", desc: "الخدمات النشطة مع المدة والسعر." },
  { method: "GET", path: "/specialists?service_id=…", desc: "الأخصائيات (اختياريًا لخدمة معيّنة)." },
  { method: "GET", path: "/availability?service_id=…&date=YYYY-MM-DD&specialist_id=…", desc: "المواعيد المتاحة ليوم معيّن." },
  { method: "POST", path: "/bookings", desc: "إنشاء طلب حجز (بانتظار التأكيد)." },
  { method: "GET", path: "/bookings/{id}", desc: "حالة الحجز وتفاصيله." },
  { method: "POST", path: "/bookings/{id}/cancel", desc: "إلغاء حجز بانتظار التأكيد بطلب من العميل." },
];

export default function IntegrationsPage({ params }: PageProps<"/dashboard/[salonId]/integrations">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Integrations params={params} />
    </Suspense>
  );
}

async function Integrations({ params }: { params: PageProps<"/dashboard/[salonId]/integrations">["params"] }) {
  const { salonId } = await params;
  const { salon, canEdit } = await requireManagedSalon(salonId);
  await connection();
  const supabase = await createClient();
  const { data: cfg } = await supabase
    .from("salon_integrations")
    .select(
      "enabled, api_key_prefix, last_used_at, webhook_url, webhook_secret, last_webhook_at, last_webhook_status, telegram_bot_username",
    )
    .eq("salon_id", salonId)
    .maybeSingle();
  const baseUrl = `${await siteOrigin()}/api/v1`;
  const hasKey = Boolean(cfg?.api_key_prefix);
  const now = new Date();
  const recentlyUsed = Boolean(cfg?.last_used_at) && now.getTime() - new Date(cfg!.last_used_at!).getTime() < 7 * 86_400_000;

  const status = !hasKey
    ? { tone: "neutral" as const, label: "غير مُعد" }
    : !cfg?.enabled
      ? { tone: "red" as const, label: "معطّل" }
      : recentlyUsed
        ? { tone: "green" as const, label: "متصل" }
        : { tone: "amber" as const, label: "جاهز، لم يُستخدم بعد" };

  const curl = `curl -H "Authorization: Bearer $SALONFLOW_API_KEY" ${baseUrl}/services`;
  const bookingExample = `POST ${baseUrl}/bookings
Authorization: Bearer <API_KEY>
Idempotency-Key: tg-<chat_id>-<message_id>
Content-Type: application/json

{
  "service_id": "<من /services>",
  "specialist_id": "<اختياري، أو اتركه فارغًا لأي أخصائية>",
  "starts_at": "<starts_at كما جاء من /availability>",
  "customer": { "full_name": "…", "phone": "+970…", "email": "…" },
  "notes": "اختياري",
  "channel_ref": "tg:<chat_id>"
}`;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">ربط الصالون مع n8n وبوت تلغرام</h2>
            <p className="mt-1 text-sm text-muted">
              لكل صالون مفتاح وإعدادات مستقلة، ولا يستطيع المفتاح الوصول إلا لبيانات هذا الصالون.
            </p>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">المفتاح الحالي</dt>
            <dd className="ltr text-start font-mono">{cfg?.api_key_prefix ? `${cfg.api_key_prefix}…` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">آخر استخدام</dt>
            <dd>{cfg?.last_used_at ? formatDateTime(cfg.last_used_at, salon.timezone) : "لم يُستخدم"}</dd>
          </div>
          <div>
            <dt className="text-muted">آخر إشعار Webhook</dt>
            <dd>
              {cfg?.last_webhook_at ? (
                <>
                  {formatDateTime(cfg.last_webhook_at, salon.timezone)}
                  <span className="ltr block text-start text-xs text-muted">{cfg.last_webhook_status}</span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-5 border-t border-line pt-4">
          <KeyPanel salonId={salonId} hasKey={hasKey} canEdit={canEdit} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-bold">طلبات HTTP (من n8n إلى المنصة)</h2>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">الرابط الأساسي:</span>
            <code className="ltr rounded-lg bg-canvas px-2 py-1 text-xs">{baseUrl}</code>
            <CopyButton value={baseUrl} />
          </div>
          <ul className="divide-y divide-line text-sm">
            {ENDPOINTS.map((e) => (
              <li key={e.method + e.path} className="py-2.5">
                <div className="ltr flex items-start gap-2 text-start">
                  <Badge tone={e.method === "GET" ? "green" : "brand"}>{e.method}</Badge>
                  <code className="break-all text-xs">{e.path}</code>
                </div>
                <p className="mt-1 text-xs text-muted">{e.desc}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            المصادقة في كل طلب: ترويسة <span className="ltr">Authorization: Bearer &lt;API_KEY&gt;</span>. الردود بصيغة JSON:{" "}
            <span className="ltr">{`{ "ok": true, "data": … }`}</span> أو <span className="ltr">{`{ "ok": false, "error": { "code", "message" } }`}</span>.
          </p>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-brand-700">مثال: إنشاء حجز</summary>
            <pre className="ltr mt-2 overflow-x-auto rounded-xl bg-canvas p-3 text-start text-xs leading-relaxed">{bookingExample}</pre>
          </details>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-brand-700">مثال: اختبار من الطرفية</summary>
            <pre className="ltr mt-2 overflow-x-auto rounded-xl bg-canvas p-3 text-start text-xs">{curl}</pre>
          </details>
        </Card>

        <Card>
          <h2 className="mb-1 font-bold">الإعدادات والإشعارات (من المنصة إلى n8n)</h2>
          <p className="mb-4 text-xs text-muted">
            عند تأكيد الحجز أو إلغائه من لوحة الصالون، نرسل طلب POST إلى رابط Webhook الخاص بـ Workflow هذا الصالون، فيبلّغ البوت
            العميل.
          </p>
          <ActionForm action={saveIntegrationSettings.bind(null, salonId)} className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={cfg?.enabled ?? true} className="size-4 accent-brand-600" />
              الربط مفعّل (إيقافه يرفض كل طلبات المفتاح فورًا)
            </label>
            <Field label="رابط Webhook في n8n (Production URL)" hint="مثل https://your-n8n.app/webhook/salon-noor">
              <input
                name="webhook_url"
                type="url"
                dir="ltr"
                defaultValue={cfg?.webhook_url ?? ""}
                placeholder="https://"
                className={inputStyles}
              />
            </Field>
            <Field label="اسم مستخدم بوت تلغرام (للعرض)">
              <input
                name="telegram_bot_username"
                dir="ltr"
                defaultValue={cfg?.telegram_bot_username ?? ""}
                placeholder="NoorSalonBot"
                className={inputStyles}
              />
            </Field>
            <SubmitButton disabled={!canEdit}>حفظ الإعدادات</SubmitButton>
          </ActionForm>

          {cfg && (
            <div className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
              <div>
                <p className="font-medium">سر التوقيع (Webhook secret)</p>
                <p className="text-xs text-muted">
                  كل إشعار يحمل الترويسة <span className="ltr">X-SalonFlow-Signature: sha256=…</span> (HMAC-SHA256 لجسم الطلب بهذا السر).
                  تحقّق منها في n8n لرفض أي طلب مزيف.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="ltr rounded-lg bg-canvas px-2 py-1 text-xs">{cfg.webhook_secret.slice(0, 6)}••••••••</code>
                  <CopyButton value={cfg.webhook_secret} label="نسخ السر" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionForm action={sendTestWebhook.bind(null, salonId)}>
                  <SubmitButton variant="secondary" pendingText="جارٍ الإرسال…">
                    إرسال إشعار تجريبي
                  </SubmitButton>
                </ActionForm>
                <ActionForm action={rotateWebhookSecret.bind(null, salonId)} confirm="توليد سر جديد؟ يجب تحديثه في n8n.">
                  <SubmitButton variant="ghost" pendingText="…" disabled={!canEdit}>
                    توليد سر جديد
                  </SubmitButton>
                </ActionForm>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-bold">خطوات ربط بوت تلغرام في n8n</h2>
        <ol className="list-decimal space-y-2 ps-5 text-sm text-muted">
          <li>
            أنشئ بوتًا من <span className="ltr">@BotFather</span> في تلغرام واحصل على التوكن، ثم أضفه في n8n كـ Telegram Credential.
          </li>
          <li>
            ولّد مفتاح API من الأعلى، وأضفه في n8n كـ Credential من نوع <b>Header Auth</b> (الاسم{" "}
            <span className="ltr">Authorization</span>، القيمة <span className="ltr">Bearer sf_live_…</span>).
          </li>
          <li>
            في الـ Workflow: <b>Telegram Trigger</b> ← اعرض الخدمات (<span className="ltr">GET /services</span>) ← الأخصائيات ← المواعيد
            المتاحة (<span className="ltr">GET /availability</span>) ← اجمع الاسم والهاتف والبريد ← <span className="ltr">POST /bookings</span>.
          </li>
          <li>
            لا تُبلغ العميل بنجاح الحجز إلا إذا كان الرد <span className="ltr">ok: true</span> وحالة الحجز{" "}
            <span className="ltr">pending</span>. عند الخطأ اعرض <span className="ltr">error.message</span> (بالعربية).
          </li>
          <li>
            أرسل <span className="ltr">channel_ref: &quot;tg:&lt;chat_id&gt;&quot;</span> مع الحجز، وأضف Webhook Trigger يستقبل إشعارات
            التأكيد والإلغاء ويرسلها لنفس <span className="ltr">chat_id</span>.
          </li>
          <li>
            استخدم <span className="ltr">Idempotency-Key</span> ثابتًا لكل محاولة حجز، فلا تتكرر الحجوزات عند إعادة الإرسال.
          </li>
        </ol>
      </Card>
    </div>
  );
}
