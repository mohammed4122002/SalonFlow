import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "SalonFlow — احجز موعدك في صالونك المفضل", template: "%s | SalonFlow" },
  description: "منصة لإدارة حجوزات الصالونات: تصفّح الصالونات وخدماتها وأسعارها وأخصائياتها.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${arabic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-line bg-surface py-6 text-center text-xs text-muted">
          SalonFlow — منصة حجوزات الصالونات
        </footer>
      </body>
    </html>
  );
}
