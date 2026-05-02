"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Car,
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  CheckCircle,
  Truck,
  RefreshCw,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  matched: "Aceito",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
  expired: "Expirado",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  matched: "bg-green-50 text-green-700",
  in_progress: "bg-yellow-50 text-yellow-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-50 text-red-600",
  expired: "bg-gray-50 text-gray-400",
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: adminApi.getStats,
    refetchInterval: 30_000,
  });

  const { data: recentRides = [], isLoading: ridesLoading } = useQuery({
    queryKey: ["admin-recent-rides"],
    queryFn: adminApi.recentRides,
    refetchInterval: 30_000,
  });

  const kpis = stats
    ? [
        {
          label: "Corridas hoje",
          value: String(stats.rides_today),
          icon: Car,
          bg: "bg-blue-50",
          color: "text-blue-600",
        },
        {
          label: "Corridas no mês",
          value: String(stats.rides_month),
          icon: TrendingUp,
          bg: "bg-indigo-50",
          color: "text-indigo-600",
        },
        {
          label: "GMV do mês",
          value: fmt(stats.gmv_month),
          icon: DollarSign,
          bg: "bg-green-50",
          color: "text-green-600",
        },
        {
          label: "Receita da plataforma",
          value: fmt(stats.revenue_month),
          icon: TrendingUp,
          bg: "bg-emerald-50",
          color: "text-emerald-600",
        },
        {
          label: "Corridas abertas",
          value: String(stats.rides_open),
          icon: Clock,
          bg: "bg-yellow-50",
          color: "text-yellow-600",
        },
        {
          label: "Motoristas online",
          value: String(stats.active_drivers),
          icon: Truck,
          bg: "bg-purple-50",
          color: "text-purple-600",
        },
        {
          label: "Verificações pendentes",
          value: String(stats.pending_drivers),
          icon: RefreshCw,
          bg: "bg-orange-50",
          color: "text-orange-600",
        },
        {
          label: "Total de usuários",
          value: String(stats.total_users),
          icon: Users,
          bg: "bg-gray-100",
          color: "text-gray-600",
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral da plataforma em tempo real</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-gray-200 mb-3" />
                <div className="w-24 h-3 bg-gray-200 rounded mb-2" />
                <div className="w-16 h-6 bg-gray-200 rounded" />
              </div>
            ))
          : kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", kpi.bg)}>
                  <kpi.icon size={18} className={kpi.color} />
                </div>
                <p className="text-gray-500 text-xs">{kpi.label}</p>
                <p className="text-gray-900 font-bold text-xl mt-0.5">{kpi.value}</p>
              </div>
            ))}
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent rides */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800">Corridas recentes</h2>
            <span className="text-xs text-gray-400">últimas 10</span>
          </div>
          {ridesLoading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : recentRides.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">Nenhuma corrida ainda</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentRides.map((ride) => (
                <li key={ride.id} className="px-6 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 text-sm font-medium truncate">
                      {ride.client?.name ?? "—"}
                    </p>
                    <p className="text-gray-400 text-xs truncate">
                      {ride.origin_address} → {ride.destination_address}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        STATUS_COLORS[ride.status] ?? "bg-gray-100 text-gray-500"
                      )}
                    >
                      {STATUS_LABELS[ride.status] ?? ride.status}
                    </span>
                    <span className="text-gray-400 text-xs">{fmtDate(ride.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick stats */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Resumo da plataforma</h2>

          {statsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between animate-pulse">
                  <div className="w-32 h-3 bg-gray-200 rounded" />
                  <div className="w-16 h-3 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="space-y-3">
              {[
                { label: "Total de corridas concluídas", value: String(stats.rides_completed) },
                {
                  label: "Motoristas aprovados",
                  value: String(stats.total_approved_drivers),
                },
                { label: "Total de usuários", value: String(stats.total_users) },
                { label: "GMV acumulado (mês)", value: fmt(stats.gmv_month) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <span className="text-gray-500 text-sm">{item.label}</span>
                  <span className="text-gray-900 font-semibold text-sm">{item.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          {stats && stats.pending_drivers > 0 && (
            <a
              href="/drivers"
              className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-orange-700 text-sm font-medium hover:bg-orange-100 transition-colors mt-2"
            >
              <RefreshCw size={14} />
              {stats.pending_drivers} motorista{stats.pending_drivers !== 1 ? "s" : ""} aguardando
              verificação
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
