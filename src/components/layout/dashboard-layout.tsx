"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  CreditCard,
  Target,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  Link2,
  BarChart3,
  Palette,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { NotificationBell } from "./notification-bell";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const adminNav: NavSection[] = [
  {
    title: "Main",
    items: [
      { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/admin/sellers", label: "Sellers", icon: <Users className="h-[18px] w-[18px]" /> },
      { href: "/admin/sellers/trash", label: "Seller Trash", icon: <Trash2 className="h-[18px] w-[18px]" /> },
      { href: "/admin/clients", label: "Clients", icon: <UserCircle className="h-[18px] w-[18px]" /> },
      { href: "/admin/clients/trash", label: "Client Trash", icon: <Trash2 className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    title: "Payments",
    items: [
      { href: "/admin/payment-links", label: "Payment Links", icon: <Link2 className="h-[18px] w-[18px]" /> },
      { href: "/admin/brands", label: "Brands", icon: <Palette className="h-[18px] w-[18px]" /> },
      { href: "/admin/transactions", label: "Transactions", icon: <CreditCard className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/admin/targets", label: "Targets", icon: <Target className="h-[18px] w-[18px]" /> },
      { href: "/admin/reports", label: "Reports", icon: <BarChart3 className="h-[18px] w-[18px]" /> },
      { href: "/admin/activity", label: "Activity", icon: <Activity className="h-[18px] w-[18px]" /> },
    ],
  },
];

const sellerNav: NavSection[] = [
  {
    title: "Main",
    items: [
      { href: "/seller", label: "Dashboard", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    title: "Work",
    items: [
      { href: "/seller/clients", label: "Clients", icon: <UserCircle className="h-[18px] w-[18px]" /> },
      { href: "/seller/payment-links", label: "Payment Links", icon: <Link2 className="h-[18px] w-[18px]" /> },
      { href: "/seller/transactions", label: "Transactions", icon: <CreditCard className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/seller/target", label: "My Target", icon: <Target className="h-[18px] w-[18px]" /> },
      { href: "/seller/analytics", label: "Analytics", icon: <BarChart3 className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/seller/profile", label: "Profile", icon: <Settings className="h-[18px] w-[18px]" /> },
    ],
  },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "SUPER_ADMIN" | "SELLER";
  userName: string;
}

export function DashboardLayout({ children, role, userName }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navSections = role === "SUPER_ADMIN" ? adminNav : sellerNav;
  const allItems = navSections.flatMap((s) => s.items);
  const homeHref = role === "SUPER_ADMIN" ? "/admin" : "/seller";

  const isActive = (href: string) =>
    pathname === href ||
    (href !== homeHref &&
      pathname.startsWith(`${href}/`) &&
      !allItems.some(
        (other) =>
          other.href !== href &&
          other.href.length > href.length &&
          (pathname === other.href || pathname.startsWith(`${other.href}/`))
      ));

  return (
    <div className="flex h-screen bg-[#f7faf9]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-[#e8eeec] bg-white transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-[72px] items-center justify-between border-b border-[#e8eeec] px-5">
          <Link href={homeHref} className="flex items-center gap-2.5">
            <Image
              src="/logo-rename.png"
              alt="BMD Digital"
              width={150}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
          <button className="text-slate-500 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {navSections.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9aa8a4]">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-[#e8f8f5] text-[#2d9a84]"
                          : "text-[#4a5c58] hover:bg-[#f3f8f6] hover:text-[#2d9a84]"
                      )}
                    >
                      <span className={cn(active ? "text-[#2d9a84]" : "text-[#5faba0]")}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[#e8eeec] p-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8f8f5] text-sm font-semibold text-[#2d9a84]">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
              <p className="text-xs text-[#9aa8a4]">{role === "SUPER_ADMIN" ? "Admin" : "Seller"}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-[#e8eeec] bg-white px-4 lg:px-6">
          <button className="text-slate-600 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
