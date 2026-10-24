import { Field, inputStyles } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { CURRENCIES, TIMEZONES } from "@/lib/format";
import { optionalText, text } from "@/lib/forms";

// Shared by "create salon" and "salon settings".
export function SalonFields({ salon }: { salon?: Tables<"salons"> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="اسم الصالون">
        <input name="name" required minLength={2} maxLength={120} defaultValue={salon?.name} className={inputStyles} />
      </Field>
      <Field label="رابط الصالون" hint="أحرف إنجليزية صغيرة وأرقام وشرطات، مثل: salon-al-ward">
        <input
          name="slug"
          required
          minLength={3}
          maxLength={60}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          dir="ltr"
          defaultValue={salon?.slug}
          className={inputStyles}
        />
      </Field>
      <Field label="الوصف" className="sm:col-span-2">
        <textarea name="description" rows={3} maxLength={2000} defaultValue={salon?.description ?? ""} className={inputStyles} />
      </Field>
      <Field label="المدينة">
        <input name="city" maxLength={80} defaultValue={salon?.city ?? ""} className={inputStyles} />
      </Field>
      <Field label="العنوان">
        <input name="address" maxLength={300} defaultValue={salon?.address ?? ""} className={inputStyles} />
      </Field>
      <Field label="هاتف الصالون">
        <input name="phone" type="tel" dir="ltr" placeholder="+966 5x xxx xxxx" defaultValue={salon?.phone ?? ""} className={inputStyles} />
      </Field>
      <Field label="بريد الصالون">
        <input name="email" type="email" dir="ltr" defaultValue={salon?.email ?? ""} className={inputStyles} />
      </Field>
      <Field label="المنطقة الزمنية" hint="تُستخدم لساعات العمل ومواعيد الحجز.">
        <select name="timezone" required defaultValue={salon?.timezone ?? ""} className={inputStyles} dir="ltr">
          <option value="" disabled>
            اختر…
          </option>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </Field>
      <Field label="العملة">
        <select name="currency" required defaultValue={salon?.currency ?? ""} className={inputStyles}>
          <option value="" disabled>
            اختر…
          </option>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export function readSalonFields(formData: FormData) {
  return {
    name: text(formData, "name"),
    slug: text(formData, "slug").toLowerCase(),
    description: optionalText(formData, "description"),
    city: optionalText(formData, "city"),
    address: optionalText(formData, "address"),
    phone: optionalText(formData, "phone"),
    email: optionalText(formData, "email"),
    timezone: text(formData, "timezone"),
    currency: text(formData, "currency"),
  };
}
