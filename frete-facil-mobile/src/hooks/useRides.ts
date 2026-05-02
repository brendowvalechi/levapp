import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { rideService, RideCreatePayload, RideStatus } from "@/services/rideService";
import { useAuthStore } from "@/store/auth";

export function useMyRides(status?: RideStatus) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["myRides", status],
    queryFn: () => rideService.myRides(status),
    enabled: !!token,
  });
}

export function useOpenRides(lat?: number, lng?: number) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["openRides", lat, lng],
    queryFn: () => rideService.openRides(lat, lng),
    enabled: !!token,
    refetchInterval: 15000,
  });
}

export function useRide(id: string) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["ride", id],
    queryFn: () => rideService.getRide(id),
    enabled: !!token && !!id,
  });
}

export function useCreateRide() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: RideCreatePayload) => rideService.createRide(data),
    onSuccess: (ride) => {
      queryClient.invalidateQueries({ queryKey: ["myRides"] });
      router.replace({ pathname: "/ride/[id]", params: { id: ride.id } });
    },
  });
}

export function useCancelRide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => rideService.cancelRide(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myRides"] });
      queryClient.invalidateQueries({ queryKey: ["ride"] });
    },
  });
}

export function useCreateOffer(rideId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ price, message }: { price: number; message?: string }) =>
      rideService.createOffer(rideId, price, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openRides"] });
      queryClient.invalidateQueries({ queryKey: ["myOffers"] });
      router.back();
    },
  });
}

export function useAcceptOffer(rideId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (offerId: string) => rideService.acceptOffer(rideId, offerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ride", rideId] });
      queryClient.invalidateQueries({ queryKey: ["myRides"] });
    },
  });
}

export function useMyOffers() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["myOffers"],
    queryFn: rideService.myOffers,
    enabled: !!token,
  });
}

export function useSetOnline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (isOnline: boolean) => rideService.setOnline(isOnline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
