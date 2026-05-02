"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, DriverListItem, VerificationStatus } from "@/lib/api";
import { CheckCircle, XCircle, Clock, Eye, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_TABS: { value: VerificationStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pendentes" },
  { value: "approved", label: "Aprovados" },
  { value: "rejected", label: "Rejeitados" },
  { value: "all", label: "Todos" },
];

const STATUS_CONFIG: Record<
  VerificationStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: "Pendente",
    icon: <Clock size={14} />,
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  approved: {
    label: "Aprovado",
    icon: <CheckCircle size={14} />,
    className: "bg-green-50 text-green-700 border-green-200",
  },
  rejected: {
    label: "Rejeitado",
    icon: <XCircle size={14} />,
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export default function DriversPage() {
  const [activeTab, setActiveTab] = useState<VerificationStatus | "all">("pending");
  const [selectedDriver, setSelectedDriver] = useState<DriverListItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: drivers, isLoading } = useQuery({
    queryKey: ["admin-drivers", activeTab],
    queryFn: () =>
      activeTab === "all" ? adminApi.listDrivers() : adminApi.listDrivers(activeTab),
  });

  const verifyMutation = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: VerificationStatus;
      reason?: string;
    }) =>
      adminApi.verifyDriver(id, {
        status,
        ...(reason ? { rejection_reason: reason } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
      setSelectedDriver(null);
      setShowRejectModal(false);
      setRejectReason("");
    },
  });

  function handleApprove(driver: DriverListItem) {
    verifyMutation.mutate({ id: driver.id, status: "approved" });
  }

  function openReject(driver: DriverListItem) {
    setSelectedDriver(driver);
    setShowRejectModal(true);
  }

  function handleRejectConfirm() {
    if (!selectedDriver || !rejectReason.trim()) return;
    verifyMutation.mutate({
      id: selectedDriver.id,
      status: "rejected",
      reason: rejectReason.trim(),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verificação de Motoristas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Analise os documentos enviados e aprove ou rejeite o cadastro.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
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
        ) : !drivers?.length ? (
          <div className="py-16 text-center text-gray-400">
            Nenhum motorista encontrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-6 py-3">Motorista</th>
                <th className="text-left px-6 py-3">CNH</th>
                <th className="text-left px-6 py-3">Documentos</th>
                <th className="text-left px-6 py-3">Avaliação</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Data</th>
                <th className="text-right px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {drivers.map((driver) => (
                <DriverRow
                  key={driver.id}
                  driver={driver}
                  onApprove={() => handleApprove(driver)}
                  onReject={() => openReject(driver)}
                  loading={
                    verifyMutation.isPending && selectedDriver?.id === driver.id
                  }
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject modal */}
      {showRejectModal && selectedDriver && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Rejeitar motorista</h3>
            <p className="text-gray-500 text-sm">
              Informe o motivo da rejeição. Esse motivo será exibido ao motorista.
            </p>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Ex: CNH ilegível, selfie não compatível com a CNH..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedDriver(null);
                  setRejectReason("");
                }}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                disabled={!rejectReason.trim() || verifyMutation.isPending}
                onClick={handleRejectConfirm}
              >
                {verifyMutation.isPending ? "Rejeitando..." : "Confirmar rejeição"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DriverRow({
  driver,
  onApprove,
  onReject,
  loading,
}: {
  driver: DriverListItem;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[driver.verification_status];

  const docs = [
    { label: "CNH Frente", url: driver.cnh_front_url },
    { label: "CNH Verso", url: driver.cnh_back_url },
    { label: "Selfie", url: driver.selfie_url },
  ];

  const completedDocs = docs.filter((d) => d.url).length;

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-6 py-4">
          <div className="font-medium text-gray-800">{driver.user?.name ?? "—"}</div>
          <div className="text-gray-400 text-xs">{driver.user?.email ?? "—"}</div>
        </td>
        <td className="px-6 py-4 text-gray-600 font-mono text-xs">
          {driver.cnh_number ?? "—"}
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {docs.map((doc) => (
                <div
                  key={doc.label}
                  className={cn(
                    "w-2 h-2 rounded-full",
                    doc.url ? "bg-green-400" : "bg-gray-200"
                  )}
                  title={doc.label}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500">{completedDocs}/3</span>
          </div>
        </td>
        <td className="px-6 py-4">
          {driver.rating_count > 0 ? (
            <div className="flex items-center gap-1">
              <Star size={13} className="fill-amber-400 text-amber-400" />
              <span className="text-gray-800 font-semibold text-sm">
                {driver.rating_avg.toFixed(1)}
              </span>
              <span className="text-gray-400 text-xs">({driver.rating_count})</span>
            </div>
          ) : (
            <span className="text-gray-300 text-xs">Sem avaliações</span>
          )}
        </td>
        <td className="px-6 py-4">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium",
              cfg.className
            )}
          >
            {cfg.icon}
            {cfg.label}
          </span>
          {driver.rejection_reason && (
            <p className="text-xs text-red-500 mt-1 max-w-32 truncate" title={driver.rejection_reason}>
              {driver.rejection_reason}
            </p>
          )}
        </td>
        <td className="px-6 py-4 text-gray-400 text-xs">
          {new Date(driver.updated_at).toLocaleDateString("pt-BR")}
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Ver documentos"
              onClick={() => setExpanded((v) => !v)}
            >
              <Eye size={16} />
            </button>
            {driver.verification_status === "pending" && (
              <>
                <button
                  className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 disabled:opacity-50 transition-colors"
                  onClick={onApprove}
                  disabled={loading}
                >
                  Aprovar
                </button>
                <button
                  className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                  onClick={onReject}
                  disabled={loading}
                >
                  Rejeitar
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Expandable document preview */}
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-6 py-4">
            <div className="flex gap-4 flex-wrap">
              {docs.map((doc) => (
                <div key={doc.label} className="flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500 font-medium">{doc.label}</span>
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noreferrer">
                      <img
                        src={doc.url}
                        alt={doc.label}
                        className="w-32 h-24 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ) : (
                    <div className="w-32 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                      <span className="text-gray-400 text-xs">Não enviado</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
