import { api } from "./api";

export type RideStatus = "open" | "matched" | "in_progress" | "completed" | "cancelled" | "expired";
export type RideCategory =
  | "carreto_simples"
  | "mudanca_residencial"
  | "mudanca_comercial"
  | "entrega_rapida"
  | "outros";
export type OfferStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface RideCreatePayload {
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  category: RideCategory;
  description?: string;
  estimated_weight_kg?: number;
  vehicle_type_preference?: string;
  scheduled_at?: string;
}

export interface OfferResponse {
  id: string;
  ride_id: string;
  driver_id: string;
  price: number;
  message: string | null;
  status: OfferStatus;
  created_at: string;
  driver?: { id: string; name: string; phone: string } | null;
}

export interface RideResponse {
  id: string;
  client_id: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  description: string | null;
  category: RideCategory;
  vehicle_type_preference: string | null;
  estimated_weight_kg: number | null;
  status: RideStatus;
  photos: string[];
  accepted_offer_id: string | null;
  distance_km: number | null;
  scheduled_at: string | null;
  expires_at: string;
  created_at: string;
  offers_count: number;
  offers?: OfferResponse[];
}

export const rideService = {
  createRide: (data: RideCreatePayload) =>
    api.post<RideResponse>("/api/v1/rides", data).then((r) => r.data),

  myRides: (status?: RideStatus) =>
    api
      .get<RideResponse[]>("/api/v1/rides/me", { params: status ? { status } : {} })
      .then((r) => r.data),

  openRides: (lat?: number, lng?: number, radius_km = 30) =>
    api
      .get<RideResponse[]>("/api/v1/rides/open", {
        params: { ...(lat !== undefined ? { lat, lng, radius_km } : {}) },
      })
      .then((r) => r.data),

  getRide: (id: string) =>
    api.get<RideResponse>(`/api/v1/rides/${id}`).then((r) => r.data),

  cancelRide: (id: string) =>
    api.post<RideResponse>(`/api/v1/rides/${id}/cancel`).then((r) => r.data),

  createOffer: (rideId: string, price: number, message?: string) =>
    api
      .post<OfferResponse>(`/api/v1/rides/${rideId}/offers`, { price, message })
      .then((r) => r.data),

  listOffers: (rideId: string) =>
    api.get<OfferResponse[]>(`/api/v1/rides/${rideId}/offers`).then((r) => r.data),

  acceptOffer: (rideId: string, offerId: string) =>
    api
      .post<RideResponse>(`/api/v1/rides/${rideId}/offers/${offerId}/accept`)
      .then((r) => r.data),

  cancelOffer: (offerId: string) =>
    api.post<OfferResponse>(`/api/v1/offers/${offerId}/cancel`).then((r) => r.data),

  myOffers: () =>
    api.get<OfferResponse[]>("/api/v1/offers/me").then((r) => r.data),

  setOnline: (isOnline: boolean) =>
    api.post("/api/v1/driver/online", { is_online: isOnline }).then((r) => r.data),

  updateLocation: (lat: number, lng: number) =>
    api.post("/api/v1/driver/location", { lat, lng }).then((r) => r.data),
};
