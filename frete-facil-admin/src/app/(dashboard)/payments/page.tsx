"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";

type PaymentStatus =
  | "pending"
  | "approved"
  | "in_escrow"
  | "released"
  | "refunded"
  | "cancelled"
  | "failed";

type PaymentMethod = "pix" | "checkout_pro";

interface PaymentItem {
  id: string;
  ride_id: string;
  client_id: string;
  driver_id: string;
  amount: number;
  platform_fee: number;
  driver_amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  mp_payment_id: string | null;
  paid_at: string | null;
  released_at: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; className: string }> = {
  pending: { label: "Aguardando", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  approved: { label: "Aprovado", className: "bg-green-50 text-green-700 border-green-200" },
  in_escrow: { label: "Em escrow", className: "bg-blue-50 text-blue-700 border-blue-200" },
  released: { label: "Liberado", className: "bg-gray-100 text-gray-600 border-gray-200" },
  refunded: { label: "Reembolsado", className: "bg-orange-50 text-orange-700 border-orange-200" },
  cancelled: { label: "Cancelado", className: "bg-red-50 text-red-600 border-red-200" },
  failed: { label: "Falhou", className: "bg-red-100 text-red-700 border-red-200" },
};

const RELEASABLE: PaymentStatus[] = ["approved", "in_escrow"];

function fmt(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<PaymentStatus | "all">("all");
  const [releasing, setReleasing] = useState<string | null>(null);

  const { data: payments = [], isLoading } = useQuery<PaymentItem[]>({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const r = await api.get("/api/v1/admin/payments?page_size=200");
      return r.data;
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (paymentId: string) =>
      api.post(`/api/v1/admin/payments/${paymentId}/release`),
    onMutate: (id) => setReleasing(id),
    onSettled: () => {
      setReleasing(null);
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
    },
  });

  const filtered = filter === "all" ? payments : payments.filter((p) => p.status === filter);

  const totals = {
    volume: payments.reduce((s, p) => s + (p.status !== "failed" && p.status !== "cancelled" ? p.amount : 0), 0),
    platform: payments.reduce((s, p) => s + (p.status === "released" ? p.platform_fee : 0), 0),
    pending: payments.filter((p) => RELEASABLE.includes(p.status)).length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie os pagamentos e liberações ao motorista</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<DollarSign size={20} className="text-green-600" />}
          label="Volume total"
          value={fmt(totals.volume)}
          bg="bg-green-50"
        />
        <StatCard
          icon={<ArrowUpRight size={20} className="text-blue-600" />}
          label="Taxa da plataforma (liberados)"
          value={fmt(totals.platform)}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<Clock size={20} className="text-yellow-600" />}
          label="Aguardando liberação"
          value={String(totals.pending)}
          bg="bg-yellow-50"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "approved", "in_escrow", "released", "failed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
              filter === s
                ? "bg-blue-700 text-white border-blue-700"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            )}
          >
            {s === "all" ? "Todos" : STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" />
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <AlertCircle size={20} className="mr-2" />
            Nenhum pagamento encontrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">ID pagamento</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Método</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Valor</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Taxa</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Motorista recebe</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Data</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const cfg = STATUS_CONFIG[p.status];
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-gray-500 font-mono text-xs">
                        {p.id.slice(0, 8)}…
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-700 capitalize">
                          {p.method === "pix" ? "Pix" : "Cartão"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">{fmt(p.amount)}</td>
                      <td className="py-3 px-4 text-gray-500">{fmt(p.platform_fee)}</td>
                      <td className="py-3 px-4 text-green-700 font-medium">{fmt(p.driver_amount)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium",
                            cfg.className
                          )}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{fmtDate(p.created_at)}</td>
                      <td className="py-3 px-4">
                        {RELEASABLE.includes(p.status) ? (
                          <button
                            onClick={() => releaseMutation.mutate(p.id)}
                            disabled={releasing === p.id}
                            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {releasing === p.id ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle size={12} />
                            )}
                            Liberar
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={cn("p-3 rounded-xl", bg)}>{icon}</div>
      <div>
        <p className="text-gray-500 text-xs">{label}</p>
        <p className="text-gray-900 font-bold text-xl">{value}</p>
      </div>
    </div>
  );
}
