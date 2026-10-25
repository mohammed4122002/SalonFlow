# SalonFlow

منصة SaaS لإدارة حجوزات الصالونات (Next.js + TypeScript + Supabase) مع API لربط n8n وبوت Telegram.

## الحالة

- [x] المرحلة 1: قاعدة البيانات والمصادقة والصلاحيات. راجع [`docs/phase-1-database.md`](docs/phase-1-database.md)
- [x] المرحلة 2: الواجهات. راجع [`docs/phase-2-frontend.md`](docs/phase-2-frontend.md)
- [x] المرحلة 3: نظام الحجز. راجع [`docs/phase-3-booking.md`](docs/phase-3-booking.md)
- [x] المرحلة 4: الاشتراكات. راجع [`docs/phase-4-subscriptions.md`](docs/phase-4-subscriptions.md)
- [x] المرحلة 5: API وإعدادات الربط لكل صالون. راجع [`docs/phase-5-n8n-api.md`](docs/phase-5-n8n-api.md) (Workflow n8n نفسه لم يُبنَ بعد)
- [ ] المرحلة 6: الاختبار النهائي

## التشغيل

```bash
npm install
cp .env.example .env.local   # ضع SALONFLOW_SUPABASE_URL و SALONFLOW_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

اختياري: `RESEND_API_KEY` و`EMAIL_FROM` لإرسال البريد، و`SALONFLOW_SITE_URL` للروابط داخل الرسائل (راجع `.env.example`).

## الاختبارات

```bash
npx tsc --noEmit && npm run lint && npm run build
psql "$DATABASE_URL" -f supabase/tests/phase1_test.sql       # الصلاحيات والقيود (تتراجع ولا تحفظ بيانات)
psql "$DATABASE_URL" -f supabase/tests/phase3to5_test.sql    # الحجز والاشتراكات والـ API
DATABASE_URL=... supabase/tests/concurrency_test.sh          # حجوزات متزامنة
```

## الهيكل

```
src/app/               الصفحات (الرئيسية، الصالون، الحجز، الدخول، لوحة الصالون، لوحة الإدارة)
src/app/api/v1/        API الربط مع n8n (بمفتاح كل صالون)
src/components/        مكونات الواجهة المشتركة
src/lib/               Supabase، الصلاحيات، التنسيق، رسائل الأخطاء
src/proxy.ts           تجديد الجلسة وحماية المسارات
supabase/migrations/   ملفات قاعدة البيانات (تُطبّق بالترتيب)
supabase/tests/        اختبارات الصلاحيات والقيود والتزامن
docs/                  توثيق كل مرحلة
```
