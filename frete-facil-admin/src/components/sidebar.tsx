"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  LayoutDashboard,
  Car,
  Users,
  Truck,
  CreditCard,
  LogOut,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout, adminApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/rides", label: "Corridas", icon: Car },
  { href: "/users", label: "Usuários", icon: Users },
  { href: "/drivers", label: "Motoristas", icon: Truck, badge: "pending_drivers" },
  { href: "/payments", label: "Pagamentos", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: adminApi.getStats,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const badgeValues: Record<string, number> = {
    pending_drivers: stats?.pending_drivers ?? 0,
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-700 rounded-xl flex items-center justify-center">
            <Truck size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Levapp</p>
            <p className="text-xs text-gray-400">Painel Admin</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const badgeCount = item.badge ? badgeValues[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href as Route}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && (
                <span className="bg-orange-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 w-full transition-colors"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  );
}
