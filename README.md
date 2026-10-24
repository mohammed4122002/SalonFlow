# SalonFlow

منصة SaaS لإدارة حجوزات الصالونات (Next.js + TypeScript + Supabase، وربط n8n لاحقًا).

## الحالة

- [x] المرحلة 1: قاعدة البيانات والمصادقة والصلاحيات. راجع [`docs/phase-1-database.md`](docs/phase-1-database.md)
- [x] المرحلة 2: الواجهات (بانتظار المراجعة). راجع [`docs/phase-2-frontend.md`](docs/phase-2-frontend.md)
- [ ] المرحلة 3: نظام الحجز
- [ ] المرحلة 4: الاشتراكات
- [ ] المرحلة 5: n8n وبوت Telegram
- [ ] المرحلة 6: الاختبار النهائي

## التشغيل

```bash
npm install
cp .env.example .env.local   # ضع NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

## الهيكل

```
src/app/               الصفحات (الرئيسية، الصالون، الدخول، لوحة الصالون، لوحة الإدارة)
src/components/        مكونات الواجهة المشتركة
src/lib/               Supabase، الصلاحيات، التنسيق، رسائل الأخطاء
src/proxy.ts           تجديد الجلسة وحماية المسارات
supabase/migrations/   ملفات قاعدة البيانات (تُطبّق بالترتيب)
supabase/tests/        اختبارات الصلاحيات والقيود والتزامن
docs/                  توثيق كل مرحلة
```
