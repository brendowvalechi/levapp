"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  RefreshCw,
  UserX,
  UserCheck,
  Truck,
  User,
  ShieldAlert,
} from "lucide-react";
import { adminApi, UserItem, UserRole } from "@/lib/api";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<UserRole, string> = {
  client: "Cliente",
  driver: "Motorista",
  both: "Ambos",
};

const ROLE_COLORS: Record<UserRole, string> = {
  client: "bg-blue-50 text-blue-700",
  driver: "bg-green-50 text-green-700",
  both: "bg-purple-50 text-purple-700",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [suspending, setSuspending] = useState<string | null>(null);

  // Simple debounce on search
  function handleSearchChange(v: string) {
    setSearch(v);
    clearTimeout((handleSearchChange as any)._t);
    (handleSearchChange as any)._t = setTimeout(() => setDebouncedSearch(v), 400);
  }

  const { data: users = [], isLoading } = useQuery<UserItem[]>({
    queryKey: ["admin-users", debouncedSearch],
    queryFn: () => adminApi.listUsers({ search: debouncedSearch || undefined }),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      adminApi.suspendUser(id, suspend),
    onMutate: ({ id }) => setSuspending(id),
    onSettled: () => {
      setSuspending(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const active = users.filter((u) => u.is_active).length;
  const suspended = users.filter((u) => !u.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-500 text-sm mt-1">
            {users.length} usuário{users.length !== 1 ? "s" : ""} — {active} ativo{active !== 1 ? "s" : ""}{suspended > 0 ? `, ${suspended} suspenso${suspended !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center text-gray-400 gap-2 text-sm">
            <RefreshCw size={16} className="animate-spin" />
            Carregando...
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Nenhum usuário encontrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-6 py-3">Usuário</th>
                  <th className="text-left px-6 py-3">Perfil</th>
                  <th className="text-left px-6 py-3">Verificações</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-left px-6 py-3">Cadastro</th>
                  <th className="text-right px-6 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    {/* User */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          {user.role === "driver" || user.role === "both" ? (
                            <Truck size={14} className="text-green-600" />
                          ) : (
                            <User size={14} className="text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{user.name}</p>
                          <p className="text-gray-400 text-xs">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          ROLE_COLORS[user.role]
                        )}
                      >
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>

                    {/* Verifications */}
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            user.email_verified
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-400"
                          )}
                          title="E-mail"
                        >
                          E-mail
                        </span>
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            user.phone_verified
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-400"
                          )}
                          title="Telefone"
                        >
                          Tel.
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border",
                          user.is_active
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        )}
                      >
                        {user.is_active ? (
                          <UserCheck size={11} />
                        ) : (
                          <ShieldAlert size={11} />
                        )}
                        {user.is_active ? "Ativo" : "Suspenso"}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {fmtDate(user.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() =>
                          suspendMutation.mutate({ id: user.id, suspend: user.is_active })
                        }
                        disabled={suspending === user.id}
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ml-auto disabled:opacity-50",
                          user.is_active
                            ? "bg-red-50 text-red-700 hover:bg-red-100"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        )}
                      >
                        {suspending === user.id ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : user.is_active ? (
                          <UserX size={12} />
                        ) : (
                          <UserCheck size={12} />
                        )}
                        {user.is_active ? "Suspender" : "Reativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
