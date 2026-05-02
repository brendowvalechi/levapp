import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPayment, getPayment } from "@/services/paymentService";
import type { PaymentMethod, PaymentStatus } from "@/services/paymentService";

const PAID_STATUSES: PaymentStatus[] = ["approved", "in_escrow", "released"];

export function usePaymentStatus(rideId: string, enabled = true) {
  return useQuery({
    queryKey: ["payment", rideId],
    queryFn: () => getPayment(rideId),
    enabled: !!rideId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && PAID_STATUSES.includes(status)) return false;
      return 5000;
    },
  });
}

export function useCreatePayment(rideId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (method: PaymentMethod) => createPayment(rideId, method),
    onSuccess: (data) => {
      qc.setQueryData(["payment", rideId], data);
    },
  });
}
