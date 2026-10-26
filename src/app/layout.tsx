import type { Metadata } from "next";
import { El_Messiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import Link from "next/link";
import { RevealObserver } from "@/components/reveal-observer";
import { BrandMark } from "@/components/brand-mark";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

const display = El_Messiri({
  variable: "--font-display-ar",
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "SalonFlow — احجز موعدك في صالونك المفضل", template: "%s | SalonFlow" },
  description: "منصة لإدارة حجوزات الصالونات: تصفّح الصالونات وخدماتها وأسعارها وأخصائياتها، واحجز موعدك في دقيقة.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${arabic.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <RevealObserver />
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <footer className="relative overflow-hidden bg-brand-950 text-brand-100">
          <div className="hero-texture absolute inset-0 opacity-60" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
            <div>
              <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-white">
                <BrandMark className="size-9" />
                SalonFlow
              </Link>
              <p className="mt-3 max-w-xs text-sm text-brand-200/80">
                منصة حجوزات الصالونات: مواعيد فورية، لوحة تحكم لصاحب الصالون، وبوت تلغرام يحجز عنك على مدار الساعة.
              </p>
            </div>
            <nav aria-label="روابط" className="flex flex-col gap-2 text-sm">
              <p className="mb-1 font-semibold text-white">روابط</p>
              <Link href="/#salons" className="text-brand-200/80 hover:text-gold-300">
                تصفّح الصالونات
              </Link>
              <Link href="/signup" className="text-brand-200/80 hover:text-gold-300">
                سجّل صالونك
              </Link>
              <Link href="/login" className="text-brand-200/80 hover:text-gold-300">
                دخول أصحاب الصالونات
              </Link>
            </nav>
            <div className="text-sm text-brand-200/80">
              <p className="mb-1 font-semibold text-white">لأصحاب الصالونات</p>
              <p>تجربة مجانية 30 يومًا، بدون بطاقة دفع.</p>
            </div>
          </div>
          <p className="relative border-t border-white/10 py-5 text-center text-xs text-brand-200/60">
            © SalonFlow — منصة حجوزات الصالونات
          </p>
        </footer>
      </body>
    </html>
  );
}
