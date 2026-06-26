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
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  Link2,
  BarChart3,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: "/admin/sellers", label: "Sellers", icon: <Users className="h-5 w-5" /> },
  { href: "/admin/clients", label: "Clients", icon: <UserCircle className="h-5 w-5" /> },
  { href: "/admin/payment-links", label: "Payment Links", icon: <Link2 className="h-5 w-5" /> },
  { href: "/admin/brands", label: "Brands", icon: <Palette className="h-5 w-5" /> },
  { href: "/admin/transactions", label: "Transactions", icon: <CreditCard className="h-5 w-5" /> },
  { href: "/admin/targets", label: "Targets", icon: <Target className="h-5 w-5" /> },
  { href: "/admin/reports", label: "Reports", icon: <BarChart3 className="h-5 w-5" /> },
  { href: "/admin/activity", label: "Activity", icon: <Activity className="h-5 w-5" /> },
];

const sellerNav: NavItem[] = [
  { href: "/seller", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: "/seller/clients", label: "Clients", icon: <UserCircle className="h-5 w-5" /> },
  { href: "/seller/payment-links", label: "Payment Links", icon: <Link2 className="h-5 w-5" /> },
  { href: "/seller/transactions", label: "Transactions", icon: <CreditCard className="h-5 w-5" /> },
  { href: "/seller/target", label: "My Target", icon: <Target className="h-5 w-5" /> },
  { href: "/seller/analytics", label: "Analytics", icon: <BarChart3 className="h-5 w-5" /> },
  { href: "/seller/profile", label: "Profile", icon: <Settings className="h-5 w-5" /> },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "SUPER_ADMIN" | "SELLER";
  userName: string;
}

export function DashboardLayout({ children, role, userName }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navItems = role === "SUPER_ADMIN" ? adminNav : sellerNav;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6 dark:border-slate-800">
          <Link href={role === "SUPER_ADMIN" ? "/admin" : "/seller"} className="flex items-center">
            <Image
              src="/logo-rename.png"
              alt="BMD Digital"
              width={160}
              height={44}
              className="h-9 w-auto object-contain"
              priority
            />
          </Link>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && item.href !== "/seller" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="mb-3 flex items-center gap-3 px-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400 font-medium">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{userName}</p>
              <p className="text-xs text-slate-500">{role === "SUPER_ADMIN" ? "Admin" : "Seller"}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
