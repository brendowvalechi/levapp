import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { authService, LoginPayload, RegisterPayload } from "@/services/authService";
import { useAuthStore } from "@/store/auth";

export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: (data: RegisterPayload) => authService.register(data),
    onSuccess: (user) => {
      // Navigate to OTP screen with phone number
      router.push({ pathname: "/(auth)/otp", params: { phone: user.phone } });
    },
  });
}

export function useLogin() {
  const { setTokens } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: LoginPayload) => authService.login(data),
    onSuccess: async (tokens) => {
      await setTokens(tokens.access_token, tokens.refresh_token);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      router.replace("/(tabs)");
    },
  });
}

export function useVerifyOtp() {
  const { setTokens } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      authService.verifyOtp(phone, code),
    onSuccess: async (_user, variables) => {
      // After OTP, user must login to get tokens
      router.replace("/(auth)/login");
    },
  });
}

export function useResendOtp() {
  return useMutation({
    mutationFn: (phone: string) => authService.resendOtp(phone),
  });
}

export function useMe() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["me"],
    queryFn: authService.getMe,
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  return async () => {
    await logout();
    queryClient.clear();
    router.replace("/(auth)/welcome");
  };
}
