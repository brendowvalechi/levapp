import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { useAuthStore } from "@/store/auth";
import { api } from "@/services/api";
import type { RideStatus } from "@/services/rideService";

export interface LiveLocation {
  lat: number;
  lng: number;
  driver_id: string;
  updated_at: string;
}

export type TrackingWsStatus = "connecting" | "open" | "closed" | "error";

interface UseTrackingOptions {
  rideId: string;
  isDriver: boolean;
  /** Driver only: interval in ms to send location (default 5000) */
  locationInterval?: number;
  onStatusUpdate?: (status: RideStatus) => void;
  onLocationUpdate?: (loc: LiveLocation) => void;
}

export function useTrackingSocket({
  rideId,
  isDriver,
  locationInterval = 5000,
  onStatusUpdate,
  onLocationUpdate,
}: UseTrackingOptions) {
  const { token } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocRef = useRef<{ lat: number; lng: number } | null>(null);
  const [wsStatus, setWsStatus] = useState<TrackingWsStatus>("closed");
  const [driverLocation, setDriverLocation] = useState<LiveLocation | null>(null);

  // Forward location update to parent and local state
  const handleLocationMsg = useCallback(
    (msg: any) => {
      const loc: LiveLocation = {
        lat: msg.lat,
        lng: msg.lng,
        driver_id: msg.driver_id,
        updated_at: msg.updated_at,
      };
      setDriverLocation(loc);
      onLocationUpdate?.(loc);
    },
    [onLocationUpdate]
  );

  const sendLocation = useCallback((lat: number, lng: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "location", lat, lng }));
    }
  }, []);

  const sendStatus = useCallback((status: RideStatus) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "status", status }));
    }
  }, []);

  useEffect(() => {
    if (!token || !rideId) return;

    const baseUrl = (api.defaults.baseURL ?? "http://localhost:8000")
      .replace("https://", "wss://")
      .replace("http://", "ws://");
    const url = `${baseUrl}/api/v1/ws/tracking/${rideId}?token=${token}`;

    setWsStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus("open");
    ws.onerror = () => setWsStatus("error");
    ws.onclose = () => setWsStatus("closed");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "location" || data.type === "snapshot") {
          handleLocationMsg(data);
        } else if (data.type === "status_update") {
          onStatusUpdate?.(data.status as RideStatus);
        }
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token, rideId, handleLocationMsg, onStatusUpdate]);

  // Driver: watch GPS and send periodically
  useEffect(() => {
    if (!isDriver || wsStatus !== "open") return;

    let mounted = true;

    async function startWatching() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || !mounted) return;

      // Get immediate first fix
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      lastLocRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      sendLocation(pos.coords.latitude, pos.coords.longitude);

      // Subscribe to updates (high accuracy for active ride)
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (loc) => {
          lastLocRef.current = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        }
      );

      // Send cached position on interval
      intervalRef.current = setInterval(() => {
        if (lastLocRef.current) {
          sendLocation(lastLocRef.current.lat, lastLocRef.current.lng);
        }
      }, locationInterval);
    }

    startWatching();

    return () => {
      mounted = false;
      watchRef.current?.remove();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isDriver, wsStatus, sendLocation, locationInterval]);

  return { wsStatus, driverLocation, sendStatus };
}
