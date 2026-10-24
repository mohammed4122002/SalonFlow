export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>;
}
