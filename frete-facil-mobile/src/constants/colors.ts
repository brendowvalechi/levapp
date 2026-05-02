export const Colors = {
  primary: "#1d4ed8",
  primaryLight: "#3b82f6",
  primaryDark: "#1e3a8a",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    700: "#374151",
    900: "#111827",
  },
  white: "#ffffff",
  black: "#000000",
};

export const RideStatus = {
  open: { label: "Aberta", color: "#2563eb", bg: "#dbeafe" },
  accepted: { label: "Aceita", color: "#7c3aed", bg: "#ede9fe" },
  in_progress: { label: "Em andamento", color: "#d97706", bg: "#fef3c7" },
  completed: { label: "Concluída", color: "#16a34a", bg: "#dcfce7" },
  cancelled: { label: "Cancelada", color: "#dc2626", bg: "#fee2e2" },
  expired: { label: "Expirada", color: "#6b7280", bg: "#f3f4f6" },
} as const;
