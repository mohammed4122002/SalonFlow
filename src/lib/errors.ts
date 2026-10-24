type DbError = { code?: string; message?: string; details?: string | null } | null | undefined;

// Turns Postgres / PostgREST errors into messages a salon owner can act on.
export function dbErrorMessage(error: DbError, fallback = "تعذّر حفظ التغييرات، حاول مرة أخرى."): string {
  if (!error) return fallback;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;

  switch (error.code) {
    case "23505":
      if (text.includes("slug")) return "رابط الصالون مستخدم من قبل، اختر رابطًا آخر.";
      if (text.includes("phone")) return "يوجد عميل مسجّل بنفس رقم الهاتف.";
      return "هذه البيانات موجودة مسبقًا.";
    case "23P01":
      if (text.includes("working_hours")) return "هذه الفترة تتداخل مع فترة عمل موجودة في نفس اليوم.";
      return "هذا الموعد يتعارض مع حجز آخر.";
    case "23503":
      return "لا يمكن الحذف لأن العنصر مرتبط بحجوزات. يمكنك إيقافه بدلًا من حذفه.";
    case "23502":
      return "يرجى تعبئة جميع الحقول المطلوبة.";
    case "22023":
      return "المنطقة الزمنية غير صحيحة.";
    case "42501":
      return "ليست لديك صلاحية لتنفيذ هذا الإجراء.";
    case "23514":
      if (text.includes("slug")) return "الرابط يجب أن يكون بأحرف إنجليزية صغيرة وأرقام وشرطات فقط (3 إلى 60 حرفًا).";
      if (text.includes("phone")) return "رقم الهاتف غير صحيح.";
      if (text.includes("email")) return "البريد الإلكتروني غير صحيح.";
      if (text.includes("working_hours") || text.includes("time_off")) return "وقت النهاية يجب أن يكون بعد وقت البداية.";
      return "بعض القيم المدخلة غير صحيحة.";
  }
  return fallback;
}

// Supabase Auth error messages (English) mapped to Arabic.
export function authErrorMessage(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (m.includes("email not confirmed")) return "يرجى تأكيد بريدك الإلكتروني أولًا من الرسالة المرسلة إليك.";
  if (m.includes("already registered") || m.includes("already been registered")) return "هذا البريد مسجّل مسبقًا. جرّب تسجيل الدخول.";
  if (m.includes("password")) return "كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.";
  if (m.includes("rate limit") || m.includes("too many")) return "محاولات كثيرة، انتظر قليلًا ثم حاول مجددًا.";
  if (m.includes("email address") && m.includes("invalid")) return "البريد الإلكتروني غير صحيح.";
  if (m.includes("not authorized")) return "تعذّر إرسال رسالة التأكيد إلى هذا البريد. تواصل مع إدارة المنصة.";
  return "حدث خطأ غير متوقع، حاول مرة أخرى.";
}
