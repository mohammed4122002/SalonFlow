"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "نظرة عامة" },
  { href: "/bookings", label: "الحجوزات" },
  { href: "/services", label: "الخدمات" },
  { href: "/specialists", label: "الأخصائيات" },
  { href: "/hours", label: "أوقات العمل" },
  { href: "/settings", label: "الإعدادات" },
];

export function SalonTabs({ salonId }: { salonId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${salonId}`;

  return (
    <nav aria-label="أقسام الصالون" className="-mx-4 mt-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {TABS.map((tab) => {
          const href = base + tab.href;
          const active = pathname === href;
          return (
            <li key={tab.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  active ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
