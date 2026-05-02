import { api } from "./api";

export type PaymentMethod = "pix" | "checkout_pro";
export type PaymentStatus =
  | "pending"
  | "approved"
  | "in_escrow"
  | "released"
  | "refunded"
  | "cancelled"
  | "failed";

export interface PaymentResponse {
  id: string;
  ride_id: string;
  client_id: string;
  driver_id: string;
  amount: number;
  platform_fee: number;
  driver_amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  mp_payment_id: string | null;
  mp_preference_id: string | null;
  pix_qr_code_base64: string | null;
  pix_copy_paste: string | null;
  checkout_url: string | null;
  paid_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function createPayment(
  rideId: string,
  method: PaymentMethod
): Promise<PaymentResponse> {
  const r = await api.post<PaymentResponse>(`/api/v1/rides/${rideId}/payment`, { method });
  return r.data;
}

export async function getPayment(rideId: string): Promise<PaymentResponse> {
  const r = await api.get<PaymentResponse>(`/api/v1/rides/${rideId}/payment`);
  return r.data;
}
