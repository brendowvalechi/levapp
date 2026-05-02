import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("admin_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("admin_token");
    document.cookie = "admin_token=; path=/; max-age=0";
    window.location.href = "/login";
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type VerificationStatus = "pending" | "approved" | "rejected";
export type UserRole = "client" | "driver" | "both";

export interface DriverListItem {
  id: string;
  cnh_number: string | null;
  cnh_front_url: string | null;
  cnh_back_url: string | null;
  selfie_url: string | null;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  rating_avg: number;
  rating_count: number;
  total_rides: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
}

export interface AdminStats {
  rides_today: number;
  rides_month: number;
  rides_completed: number;
  rides_open: number;
  gmv_month: number;
  revenue_month: number;
  pending_drivers: number;
  active_drivers: number;
  total_approved_drivers: number;
  total_users: number;
}

export interface RecentRide {
  id: string;
  origin_address: string;
  destination_address: string;
  category: string;
  status: string;
  distance_km: number | null;
  created_at: string;
  client?: { id: string; name: string; email: string };
}

// ─── API helpers ─────────────────────────────────────────────────────────────

export const adminApi = {
  // Stats
  getStats: () => api.get<AdminStats>("/api/v1/admin/stats").then((r) => r.data),
  recentRides: () => api.get<RecentRide[]>("/api/v1/admin/recent-rides").then((r) => r.data),

  // Users
  listUsers: (params?: { search?: string; page?: number }) =>
    api
      .get<UserItem[]>("/api/v1/admin/users", { params })
      .then((r) => r.data),
  suspendUser: (userId: string, suspend: boolean) =>
    api
      .patch<UserItem>(`/api/v1/admin/users/${userId}/suspend`, { suspend })
      .then((r) => r.data),

  // Drivers
  listPendingDrivers: () =>
    api.get<DriverListItem[]>("/api/v1/admin/drivers/pending").then((r) => r.data),
  listDrivers: (status?: VerificationStatus) =>
    api
      .get<DriverListItem[]>("/api/v1/admin/drivers", { params: status ? { status } : {} })
      .then((r) => r.data),
  verifyDriver: (
    driverProfileId: string,
    data: { status: VerificationStatus; rejection_reason?: string }
  ) =>
    api
      .patch<DriverListItem>(`/api/v1/admin/drivers/${driverProfileId}/verify`, data)
      .then((r) => r.data),
};
