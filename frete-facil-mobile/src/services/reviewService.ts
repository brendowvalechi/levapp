import { api } from "./api";

export interface ReviewResponse {
  id: string;
  ride_id: string;
  reviewer_id: string;
  reviewed_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface DriverRating {
  driver_id: string;
  rating_avg: number;
  rating_count: number;
}

export async function createReview(
  rideId: string,
  rating: number,
  comment?: string
): Promise<ReviewResponse> {
  const r = await api.post<ReviewResponse>(`/api/v1/rides/${rideId}/review`, {
    rating,
    comment: comment || null,
  });
  return r.data;
}

export async function getRideReviews(rideId: string): Promise<ReviewResponse[]> {
  const r = await api.get<ReviewResponse[]>(`/api/v1/rides/${rideId}/reviews`);
  return r.data;
}

export async function getDriverRating(userId: string): Promise<DriverRating> {
  const r = await api.get<DriverRating>(`/api/v1/users/${userId}/rating`);
  return r.data;
}

export async function listDriverReviews(userId: string): Promise<ReviewResponse[]> {
  const r = await api.get<ReviewResponse[]>(`/api/v1/users/${userId}/reviews`);
  return r.data;
}
