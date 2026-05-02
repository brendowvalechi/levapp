"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MapPin, Package, Clock, CheckCircle, XCircle, Truck } from "lucide-react";

type RideStatus = "open" | "matched" | "in_progress" | "completed" | "cancelled" | "expired";

interface RideItem {
  id: string;
  client_id: string;
  origin_address: string;
  destination_address: string;
  category: string;
  status: RideStatus;
  distance_km: number | null;
  offers_count: number;
  created_at: string;
  description: string | null;
  estimated_weight_kg: number | null;
}

const STATUS_CONFIG: Record<RideStatus, { label: string; className: string; icon: React.ReactNode }> = {
  open: { label: "Aberto", className: "bg-blue-50 text-blue-700 border-blue-200", icon: <Clock size={12} /> },
  matched: { label: "Aceito", className: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle size={12} /> },
  in_progress: { label: "Em andamento", className: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: <Truck size={12} /> },
  completed: { label: "Concluído", className: "bg-gray-100 text-gray-600 border-gray-200", icon: <CheckCircle size={12} /> },
  cancelled: { label: "Cancelado", className: "bg-red-50 text-red-600 border-red-200", icon: <XCircle size={12} /> },
  expired: { label: "Expirado", className: "bg-gray-50 text-gray-400 border-gray-100", icon: <XCircle size={12} /> },
};

const CATEGORY_LABELS: Record<string, string> = {
  carreto_simples: "Carreto",
  mudanca_residencial: "Mudança Res.",
  mudanca_comercial: "Mudança Com.",
  entrega_rapida: "Entrega Rápida",
  outros: "Outros",
};

const STATUS_TABS: { value: RideStatus | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "open", label: "Abertas" },
  { value: "matched", label: "Aceitas" },
  { value: "in_progress", label: "Em andamento" },
  { value: "completed", label: "Concluídas" },
  { value: "cancelled", label: "Canceladas" },
];

async function fetchRides(status?: RideStatus): Promise<RideItem[]> {
  const params = status ? { status } : {};
  // Use admin endpoint with status filter or rides/open for open ones
  const res = await api.get<RideItem[]>("/api/v1/rides/me", { params });
  return res.data;
}

export default function RidesAdminPage() {
  const [activeTab, setActiveTab] = useState<RideStatus | "all">("all");

  const { data: rides, isLoading } = useQuery({
    queryKey: ["admin-rides", activeTab],
    queryFn: () => fetchRides(activeTab === "all" ? undefined : activeTab),
  });

  const counts = rides?.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<RideStatus, number>>
  ) ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Corridas</h1>
          <p className="text-gray-500 text-sm mt-1">Monitoramento de todas as corridas da plataforma</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {(["open", "matched", "completed"] as RideStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <div
              key={s}
              className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex items-center gap-3"
            >
              <div className={cn("rounded-xl p-2 border", cfg.className)}>{cfg.icon}</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{counts[s] ?? 0}</p>
                <p className="text-gray-500 text-xs">{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === tab.value
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">Carregando...</div>
        ) : !rides?.length ? (
          <div className="py-16 text-center text-gray-400">Nenhuma corrida encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3">Rota</th>
                <th className="text-left px-6 py-3">Categoria</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Distância</th>
                <th className="text-left px-6 py-3">Propostas</th>
                <th className="text-left px-6 py-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rides.map((ride) => {
                const cfg = STATUS_CONFIG[ride.status];
                return (
                  <tr key={ride.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 max-w-xs">
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col items-center gap-0.5 mt-1 shrink-0">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          <div className="w-px h-3 bg-gray-200" />
                          <div className="w-2 h-2 rounded-full bg-red-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-gray-700 text-xs truncate">{ride.origin_address}</p>
                          <p className="text-gray-500 text-xs truncate">{ride.destination_address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {CATEGORY_LABELS[ride.category] ?? ride.category}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium",
                          cfg.className
                        )}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {ride.distance_km != null ? `${ride.distance_km.toFixed(1)} km` : "—"}
                    </td>
                    <td className="px-6 py-4 text-gray-700 text-xs font-medium">
                      {ride.offers_count ?? 0}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(ride.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
