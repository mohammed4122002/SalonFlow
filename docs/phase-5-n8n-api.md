# المرحلة 5: الربط مع n8n وبوت Telegram

لكل صالون إعدادات ربط HTTP مستقلة في `/dashboard/[id]/integrations` (تبويب «الربط (n8n)»):

| الإعداد | الاتجاه | الاستخدام |
|---|---|---|
| **مفتاح API** (`sf_live_…`) | n8n ← المنصة | يُرسل في طلبات GET/POST من n8n. يظهر مرة واحدة عند توليده، ويُحفظ منه الـ hash فقط |
| **رابط Webhook** (https) | المنصة → n8n | نرسل إليه POST عند تأكيد الحجز أو إلغائه |
| **سر التوقيع** | المنصة → n8n | توقيع HMAC-SHA256 لكل إشعار، للتحقق من أنه منا |
| تفعيل/إيقاف | — | الإيقاف يرفض المفتاح فورًا |
| اسم مستخدم البوت | — | للعرض فقط |

تعرض الصفحة أيضًا: حالة الربط (غير مُعد / جاهز / متصل / معطّل)، وآخر استخدام للمفتاح، ونتيجة آخر إشعار، وزر «إرسال إشعار تجريبي».

## المصادقة

```
Authorization: Bearer sf_live_xxxxxxxx…      (أو X-API-Key: sf_live_…)
```

- المفتاح يحدد الصالون. لا يوجد أي معامل `salon_id` في الطلبات، فلا يمكن لمفتاح صالون الوصول لصالون آخر.
- التحقق في قاعدة البيانات (`private.api_salon`): مقارنة الـ hash، ثم أن الربط مفعّل، ثم أن الصالون يعمل واشتراكه صالح.
- المفتاح لا يُسجّل في أي سجل، ولا يُرسل للمتصفح بعد عرضه أول مرة.
- لتوليد مفتاح جديد اضغط «توليد مفتاح جديد». القديم يتوقف فورًا.

## الردود

```json
{ "ok": true,  "data": … }
{ "ok": false, "error": { "code": "SLOT_UNAVAILABLE", "message": "هذا الموعد لم يعد متاحًا، اختر موعدًا آخر." } }
```

`message` بالعربية، ويمكن عرضه للعميل في البوت مباشرة. الرموز وحالات HTTP في [المرحلة 3](phase-3-booking.md#رموز-الأخطاء-من-قاعدة-البيانات)، بالإضافة إلى: `UNAUTHORIZED` 401، و`BAD_REQUEST` 400، و`INTERNAL` 500.

## نقاط الـ API — `https://<الموقع>/api/v1`

| الطريقة | المسار | الوصف |
|---|---|---|
| GET | `/ping` | اختبار الاتصال. يعيد `{ connected, salon: { id, name } }` |
| GET | `/salon` | بيانات الصالون والعملة والمنطقة الزمنية و`working_hours` (`day_of_week`: 0 = الأحد) |
| GET | `/services` | الخدمات النشطة: `id`، `name`، `duration_minutes`، `price`، `currency` |
| GET | `/specialists?service_id=` | الأخصائيات (اختياريًا لخدمة معيّنة) مع `service_ids` |
| GET | `/availability?service_id=&date=YYYY-MM-DD[&specialist_id=]` | المواعيد الحرة: `starts_at` و`ends_at` (UTC)، و`local_time` (HH:MM بتوقيت الصالون)، و`specialist_id`، و`specialist_name` |
| POST | `/bookings` | إنشاء حجز: `confirmed` إذا كان التأكيد التلقائي مفعّلًا للصالون، وإلا `pending`. يرد 201، أو 200 عند إعادة نفس الطلب |
| GET | `/bookings/{id}` | حالة الحجز وتفاصيله (لحجوزات هذا الصالون فقط) |
| POST | `/bookings/{id}/cancel` | إلغاء حجز قادم بطلب من العميل. المؤكد يُلغى فقط إذا كان التأكيد التلقائي مفعّلًا |

### إنشاء حجز

```http
POST /api/v1/bookings
Authorization: Bearer sf_live_…
Idempotency-Key: tg-<chat_id>-<message_id>
Content-Type: application/json

{
  "service_id": "68a3b950-…",
  "specialist_id": "41dcd9ca-…",          // اختياري: بدونها تُختار أخصائية متاحة
  "starts_at": "2026-10-30T07:00:00+00:00", // كما جاء من /availability دون تعديل
  "customer": { "full_name": "ريم", "phone": "+970599111222", "email": "reem@example.com" },
  "notes": "اختياري",
  "channel_ref": "tg:123456789"             // يعود في إشعارات الـ Webhook لتعرف لمن ترسل
}
```

- **Idempotency-Key** (8–120 حرفًا): إعادة الطلب بنفس المفتاح تعيد نفس الحجز (`idempotent_replay: true`، و200) ولا تُنشئ حجزًا مكررًا. إعادة الإرسال آمنة عند انقطاع الشبكة أو انتهاء المهلة.
- **لا تؤكد للعميل نجاح الحجز** إلا إذا كان الرد `ok: true`. إذا كان `data.status = "confirmed"` فالحجز مؤكد، وإذا كان `"pending"` فهو بانتظار تأكيد الصالون. عند `SLOT_UNAVAILABLE` اعرض المواعيد من جديد.
- الطلبات المتزامنة على نفس الموعد ينجح منها واحد فقط، والبقية ترد 409.

## إشعارات Webhook (من المنصة إلى n8n)

```http
POST <رابط Webhook الخاص بالصالون>
Content-Type: application/json
X-SalonFlow-Event: booking.confirmed        (أو booking.cancelled أو test)
X-SalonFlow-Signature: sha256=<HMAC-SHA256(body, webhook_secret) hex>

{ "event": "booking.confirmed", "sent_at": "…", "data": { "id": "…", "status": "confirmed", "channel_ref": "tg:123456789",
  "starts_at": "…", "timezone": "Asia/Gaza", "service": {…}, "specialist": {…}, "customer": {…}, "salon": {…} } }
```

- جسم الطلب JSON **قانوني** (مفاتيح الكائنات مرتّبة أبجديًا على كل المستويات)، والتوقيع على هذا النص نفسه. فيمكن التحقق إما من الجسم الخام، أو بإعادة بناء JSON مرتّب المفاتيح من الجسم بعد قراءته (كما في `n8n/salon-noor/canonicalize_body.js`).
- الرابط يجب أن يكون https عامًا. الروابط المحلية والعناوين الخاصة مرفوضة (حماية من SSRF)، وإعادة التوجيه لا تُتبع، والمهلة 8 ثوانٍ.
- التحقق من التوقيع في n8n (عقدة Code):

1. عقدة Code تبني النص القانوني من `$json.body`.
2. عقدة Crypto (HMAC، SHA256، hex) تحسب التوقيع عليه بسرّ الصالون.
3. عقدة Code تقارن `sha256=<الناتج>` مع الترويسة `x-salonflow-signature`، وترفض الطلب إن كان أقدم من 10 دقائق.

لا تستخدم `JSON.stringify($json.body)` مباشرة، لأن n8n قد يغيّر ترتيب المفاتيح.

## إعداد Workflow بوت Telegram في n8n (لكل صالون)

1. **Credentials:**
   - Telegram API: توكن البوت من `@BotFather`.
   - Header Auth: الاسم `Authorization`، والقيمة `Bearer sf_live_…`.
2. **Workflow الحجز:** Telegram Trigger ← حسب حالة المحادثة:
   - `GET /services`: أزرار الخدمات.
   - `GET /specialists?service_id=`: الأخصائيات، مع زر «أي أخصائية».
   - اختيار اليوم ← `GET /availability`: أزرار الأوقات (`local_time`).
   - جمع الاسم والهاتف والبريد.
   - `POST /bookings` مع `Idempotency-Key` و`channel_ref: "tg:<chat_id>"`.
   - IF `ok`: «تم استلام طلبك، بانتظار تأكيد الصالون». وإلا: أرسل `error.message`.
3. **Workflow الإشعارات:** Webhook Trigger (POST) ← تحقق التوقيع ← استخرج `chat_id` من `data.channel_ref` ← Telegram Send Message («تم تأكيد حجزك…» أو «تم إلغاء حجزك…»).
4. ضع Production URL لعقدة Webhook في إعدادات الربط بالصالون، ثم اضغط «إرسال إشعار تجريبي».

لكل صالون Workflow ومفتاح ورابط Webhook وسر مستقل.

## الأمان

- المفاتيح تُخزَّن كـ SHA-256 فقط. عمود الـ hash لا يُقرأ من أي دور (صلاحيات على مستوى الأعمدة).
- إعدادات صالون لا يقرأها إلا مالكه أو المدير (RLS).
- جدول `booking_requests` (Idempotency) مغلق تمامًا. هذا سبب ملاحظة Supabase «RLS Enabled No Policy»، وهو مقصود.
- دوال `api_*` مكشوفة لدور `anon` عمدًا (`SECURITY DEFINER`)، لأن المصادقة داخلها بالمفتاح. لهذا تظهر في ملاحظات Supabase الأمنية، وهذا مقصود.
- سجلات الخادم لا تحتوي المفاتيح ولا الأسرار. البريد يظهر فيها مخفيًا.

## الملفات

- `supabase/migrations/20261025075426_integrations_api.sql`
- `src/app/api/v1/**`: نقاط الـ API
- `src/lib/api.ts`، و`src/lib/notifications.ts` (`deliverWebhook`)
- `src/app/dashboard/[salonId]/integrations/`: صفحة الإعدادات
