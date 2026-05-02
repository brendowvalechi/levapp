import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  setTokens: (access: string, refresh: string) => Promise<void>;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "client" | "driver" | "both";
  avatar_url: string | null;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  user: null,

  setTokens: async (access, refresh) => {
    await SecureStore.setItemAsync("access_token", access);
    await SecureStore.setItemAsync("refresh_token", refresh);
    set({ token: access, refreshToken: refresh });
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    await SecureStore.deleteItemAsync("access_token");
    await SecureStore.deleteItemAsync("refresh_token");
    set({ token: null, refreshToken: null, user: null });
  },

  loadFromStorage: async () => {
    const access = await SecureStore.getItemAsync("access_token");
    const refresh = await SecureStore.getItemAsync("refresh_token");
    if (access && refresh) {
      set({ token: access, refreshToken: refresh });
    }
  },
}));
