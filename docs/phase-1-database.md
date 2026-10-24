# المرحلة 1 — قاعدة البيانات والمصادقة والصلاحيات

مشروع Supabase: `salonflow` (المعرّف `ivusybbjhtegrlzftdma`، المنطقة `eu-central-1`، الخطة المجانية).

## الملفات

| الملف | المحتوى |
|---|---|
| `supabase/migrations/20261024091512_schema.sql` | الأنواع والجداول والقيود |
| `supabase/migrations/20261024091536_functions_triggers.sql` | دوال الصلاحيات والـ triggers |
| `supabase/migrations/20261024091603_rls_policies.sql` | سياسات RLS وصلاحيات الجداول |
| `supabase/migrations/20261024092000_advisor_fixes.sql` | إصلاحات تنبيهات Supabase (search_path + فهارس) |
| `supabase/tests/phase1_test.sql` | 65 اختبارًا آليًا (تُلغى كل بياناتها بـ ROLLBACK) |
| `supabase/tests/concurrency_test.sh` | اختبار حجزين متزامنين على نفس الموعد |
| `.env.example` | قالب متغيرات البيئة |

## الجداول

| الجدول | الوصف |
|---|---|
| `profiles` | حساب لكل مستخدم في `auth.users`، فيه الدور `super_admin` أو `salon_owner` |
| `salons` | الصالون (المستأجر)، مع `owner_id` و`status` (active/suspended) و`is_published` |
| `services` | الخدمات: المدة بالدقائق والسعر وحالة التفعيل |
| `specialists` | الأخصائيات |
| `specialist_services` | الخدمات التي تقدّمها كل أخصائية |
| `working_hours` | ساعات العمل الأسبوعية (0 = الأحد). إذا كان `specialist_id` فارغًا فهي ساعات الصالون كله |
| `time_off` | الإجازات (للصالون كله أو لأخصائية) |
| `customers` | عملاء كل صالون (الاسم والهاتف والبريد كلها إلزامية، والهاتف فريد داخل الصالون) |
| `bookings` | الحجوزات: `pending` / `confirmed` / `cancelled` |
| `subscriptions` | اشتراك واحد لكل صالون، يُنشأ تلقائيًا بتجربة 30 يومًا. أعمدة بوابة الدفع جاهزة وفارغة |

## الصلاحيات (RLS)

- **المدير العام (`super_admin`):** وصول كامل لكل الصالونات، وهو وحده من يعلّق الصالونات ويعدّل الاشتراكات ويحذف.
- **صاحب الصالون:** يدير بيانات صالوناته فقط. لا يستطيع رؤية بيانات صالون آخر أو تعديلها، ولا تغيير دوره أو حالة صالونه أو اشتراكه، ولا نقل ملكية الصالون، ولا حذف الحجوزات (يلغيها فقط).
- **الزائر (anon):** يقرأ فقط الصالونات المنشورة وغير المعلّقة، وخدماتها وأخصائياتها النشطة وساعات عملها. لا يصل أبدًا إلى العملاء أو الحجوزات أو الإجازات أو الاشتراكات أو الحسابات.
- إنشاء الحجز من الزائر سيكون في المرحلة 3 عبر دالة مخصّصة، وليس بالكتابة المباشرة في الجدول.
- كل جدول فرعي يرتبط بالصالون بمفتاح مركّب `(id, salon_id)`، فلا يمكن ربط خدمة أو عميل من صالون بحجز في صالون آخر.
- صلاحية `TRUNCATE` مسحوبة من أدوار الـ API لأنها تتجاوز RLS.

## منع تضارب المواعيد

- قيد `bookings_no_specialist_overlap` يمنع حجزين نشطين متداخلين لنفس الأخصائية.
- قيد `bookings_no_customer_overlap` يمنع حجزين نشطين متداخلين لنفس العميل.
- القيدان من نوع EXCLUDE ينفّذهما Postgres بشكل ذرّي، فإذا وصل طلبان في نفس اللحظة ينجح واحد فقط. هذا ما يتحقق منه `concurrency_test.sh`.
- الحجز الملغي لا يدخل في القيد، فيتحرر وقته فورًا.
- مسار الحالات: `pending → confirmed | cancelled` و`confirmed → cancelled`. الحجز الملغي لا يعود، والمؤكد لا يرجع إلى «بانتظار التأكيد».
- لا يُقبل الحجز إذا كانت الأخصائية لا تقدّم الخدمة المطلوبة.
- ساعات العمل المتداخلة لنفس الأخصائية في نفس اليوم مرفوضة.

> التحقق من أن الموعد يقع ضمن ساعات العمل وخارج الإجازات سيكون في المرحلة 3 داخل دالة الحجز.

## إعداد المفاتيح بأمان

1. في Supabase Dashboard افتح **Project Settings → API Keys**.
2. انسخ الملف: `cp .env.example .env.local` (الملف `.env.local` مستثنى في `.gitignore`).
3. ضع القيم:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ivusybbjhtegrlzftdma.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = المفتاح الذي يبدأ بـ `sb_publishable_` (آمن في المتصفح لأن RLS تحمي البيانات).
   - `SUPABASE_SECRET_KEY` = المفتاح الذي يبدأ بـ `sb_secret_`. هذا المفتاح يتجاوز RLS، فيُستخدم في الخادم فقط، ولا يوضع أبدًا في متغير يبدأ بـ `NEXT_PUBLIC_` ولا في Git.
4. عند النشر (مثلًا على Vercel) ضع نفس المتغيرات في إعدادات البيئة في المنصة، وليس في الكود.

## إعدادات المصادقة المقترحة (Authentication → Sign In / Providers)

- فعّل **Email** وفعّل **Confirm email** حتى يؤكد كل صاحب صالون بريده.
- **Site URL** و**Redirect URLs** نضبطهما في المرحلة 2 عندما يتوفر رابط الواجهة.

## تعيين المدير العام

كل حساب جديد يُنشأ بدور `salon_owner`، ولا يمكن رفعه إلى مدير من الواجهة أو من بيانات التسجيل. بعد أن تنشئ حسابك (من **Authentication → Users → Add user** أو من صفحة التسجيل في المرحلة 2) شغّل هذا في **SQL Editor**:

```sql
update public.profiles
set role = 'super_admin'
where id = (select id from auth.users where email = 'your-email@example.com');
```

## خطوات الاختبار

### 1) الاختبارات الآلية (65 اختبارًا)
افتح **SQL Editor**، والصق محتوى `supabase/tests/phase1_test.sql`، ثم اضغط **Run**. النتيجة جدول فيه عمود `passed`، ويجب أن تكون كل القيم `true`. لا تبقى أي بيانات بعد التشغيل لأن الملف ينتهي بـ `ROLLBACK`.

أو عبر psql: `psql "$DATABASE_URL" -f supabase/tests/phase1_test.sql`

### 2) اختبار التزامن
```bash
export DATABASE_URL="postgresql://..."   # Dashboard > Connect > Session pooler
./supabase/tests/concurrency_test.sh
```
النتيجة المتوقعة: نجاح الاتصال الأول، ورفض الثاني بـ `bookings_no_specialist_overlap`، ثم `PASS`.

### 3) تجربة يدوية سريعة
1. أنشئ مستخدمَين من **Authentication → Users → Add user** (مع Auto Confirm).
2. تحقق من **Table Editor → profiles**: سيظهر لكل منهما صف بدور `salon_owner`.
3. اجعل أحدهما مديرًا بالأمر السابق.
4. اختبار RLS كمستخدم معيّن من SQL Editor:
   ```sql
   begin;
   select set_config('request.jwt.claims', '{"sub":"<user-id>","role":"authenticated"}', true);
   set local role authenticated;
   select * from public.salons;      -- يرى صالوناته والصالونات المنشورة فقط
   select * from public.customers;   -- عملاء صالوناته فقط
   rollback;
   ```
