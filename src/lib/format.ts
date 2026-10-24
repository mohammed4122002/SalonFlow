// Arabic UI with Latin digits for prices, times and phone numbers.
const LOCALE = "ar-u-nu-latn";

export const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export const BOOKING_STATUS_LABELS = {
  pending: "بانتظار التأكيد",
  confirmed: "مؤكد",
  cancelled: "ملغي",
} as const;

export const SALON_STATUS_LABELS = {
  active: "نشط",
  suspended: "معلّق",
} as const;

export const SUBSCRIPTION_STATUS_LABELS = {
  trialing: "فترة تجريبية",
  active: "مشترك",
  past_due: "متأخر الدفع",
  suspended: "معلّق",
  cancelled: "ملغي",
} as const;

export function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} دقيقة`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? "ساعة" : h === 2 ? "ساعتان" : `${h} ساعات`;
  return m ? `${hours} و${m} دقيقة` : hours;
}

// "09:30:00" -> "09:30"
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso),
  );
}

export function daysUntil(iso: string, now: Date): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}

export const TIMEZONES = [
  "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain", "Asia/Muscat",
  "Asia/Amman", "Asia/Gaza", "Asia/Hebron", "Asia/Jerusalem", "Asia/Beirut", "Asia/Damascus",
  "Asia/Baghdad", "Africa/Cairo", "Africa/Tripoli", "Africa/Tunis", "Africa/Algiers",
  "Africa/Casablanca", "Africa/Khartoum", "Asia/Aden", "Europe/Istanbul", "Europe/London", "UTC",
];

export const CURRENCIES = [
  { code: "SAR", name: "ريال سعودي" },
  { code: "AED", name: "درهم إماراتي" },
  { code: "KWD", name: "دينار كويتي" },
  { code: "QAR", name: "ريال قطري" },
  { code: "BHD", name: "دينار بحريني" },
  { code: "OMR", name: "ريال عماني" },
  { code: "JOD", name: "دينار أردني" },
  { code: "ILS", name: "شيكل" },
  { code: "EGP", name: "جنيه مصري" },
  { code: "IQD", name: "دينار عراقي" },
  { code: "LBP", name: "ليرة لبنانية" },
  { code: "MAD", name: "درهم مغربي" },
  { code: "TND", name: "دينار تونسي" },
  { code: "DZD", name: "دينار جزائري" },
  { code: "LYD", name: "دينار ليبي" },
  { code: "TRY", name: "ليرة تركية" },
  { code: "USD", name: "دولار أمريكي" },
  { code: "EUR", name: "يورو" },
];
