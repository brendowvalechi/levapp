import { api } from "./api";

export interface DriverLocation {
  lat: number;
  lng: number;
  driver_id: string;
  updated_at: string;
}

export const trackingService = {
  getDriverLocation: (rideId: string) =>
    api.get<DriverLocation>(`/api/v1/rides/${rideId}/driver-location`).then((r) => r.data),
};
