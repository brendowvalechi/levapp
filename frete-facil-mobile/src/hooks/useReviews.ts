import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createReview,
  getDriverRating,
  getRideReviews,
  listDriverReviews,
} from "@/services/reviewService";

export function useCreateReview(rideId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rating, comment }: { rating: number; comment?: string }) =>
      createReview(rideId, rating, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ride-reviews", rideId] });
      qc.invalidateQueries({ queryKey: ["ride", rideId] });
    },
  });
}

export function useRideReviews(rideId: string) {
  return useQuery({
    queryKey: ["ride-reviews", rideId],
    queryFn: () => getRideReviews(rideId),
    enabled: !!rideId,
  });
}

export function useDriverRating(userId: string | undefined) {
  return useQuery({
    queryKey: ["driver-rating", userId],
    queryFn: () => getDriverRating(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useDriverReviews(userId: string | undefined) {
  return useQuery({
    queryKey: ["driver-reviews", userId],
    queryFn: () => listDriverReviews(userId!),
    enabled: !!userId,
  });
}
