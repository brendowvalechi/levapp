import { api } from "./api";

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "client" | "driver" | "both";
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "client" | "driver" | "both";
  avatar_url: string | null;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
}

export const authService = {
  register: async (data: RegisterPayload): Promise<UserResponse> => {
    const res = await api.post<UserResponse>("/api/v1/auth/register", data);
    return res.data;
  },

  login: async (data: LoginPayload): Promise<TokenResponse> => {
    const res = await api.post<TokenResponse>("/api/v1/auth/login", data);
    return res.data;
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const res = await api.post<TokenResponse>("/api/v1/auth/refresh", {
      refresh_token: refreshToken,
    });
    return res.data;
  },

  verifyOtp: async (phone: string, code: string): Promise<UserResponse> => {
    const res = await api.post<UserResponse>("/api/v1/auth/otp/verify", { phone, code });
    return res.data;
  },

  resendOtp: async (phone: string): Promise<void> => {
    await api.post("/api/v1/auth/otp/resend", { phone });
  },

  getMe: async (): Promise<UserResponse> => {
    const res = await api.get<UserResponse>("/api/v1/users/me");
    return res.data;
  },
};
