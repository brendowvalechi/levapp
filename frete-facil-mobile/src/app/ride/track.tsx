import { useState, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRide } from "@/hooks/useRides";
import { useMe } from "@/hooks/useAuth";
import { useTrackingSocket } from "@/hooks/useTracking";
import type { LiveLocation } from "@/hooks/useTracking";
import type { RideStatus } from "@/services/rideService";

const STATUS_LABELS: Partial<Record<RideStatus, string>> = {
  matched: "Aguardando motorista",
  in_progress: "Em andamento",
  completed: "Corrida concluída",
};

const STATUS_COLORS: Partial<Record<RideStatus, string>> = {
  matched: "bg-yellow-500",
  in_progress: "bg-green-600",
  completed: "bg-gray-500",
};

export default function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: user } = useMe();
  const { data: ride, isLoading } = useRide(id!);
  const mapRef = useRef<MapView>(null);

  const isDriver =
    (user?.role === "driver" || user?.role === "both") &&
    ride?.client_id !== user?.id;

  const [rideStatus, setRideStatus] = useState<RideStatus>(
    (ride?.status as RideStatus) ?? "matched"
  );
  const [driverLoc, setDriverLoc] = useState<LiveLocation | null>(null);

  const handleStatusUpdate = useCallback((status: RideStatus) => {
    setRideStatus(status);
    if (status === "completed") {
      if (!isDriver) {
        // Client: prompt to review
        Alert.alert("Corrida finalizada!", "Deseja avaliar o motorista agora?", [
          { text: "Agora não", onPress: () => router.replace("/(tabs)/rides") },
          {
            text: "Avaliar",
            onPress: () =>
              router.replace({
                pathname: "/ride/review",
                params: { rideId: id },
              }),
          },
        ]);
      } else {
        Alert.alert("Corrida finalizada!", "A corrida foi concluída com sucesso.", [
          { text: "OK", onPress: () => router.replace("/(tabs)/rides") },
        ]);
      }
    }
  }, [router, isDriver, id]);

  const handleLocationUpdate = useCallback((loc: LiveLocation) => {
    setDriverLoc(loc);
    mapRef.current?.animateToRegion(
      { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      400
    );
  }, []);

  const { wsStatus, sendStatus } = useTrackingSocket({
    rideId: id!,
    isDriver,
    onStatusUpdate: handleStatusUpdate,
    onLocationUpdate: handleLocationUpdate,
  });

  function handleStartRide() {
    Alert.alert("Iniciar corrida", "Confirmar início da corrida?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Iniciar", onPress: () => sendStatus("in_progress") },
    ]);
  }

  function handleCompleteRide() {
    Alert.alert("Finalizar corrida", "Confirmar conclusão da corrida?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Finalizar", style: "destructive", onPress: () => sendStatus("completed") },
    ]);
  }

  if (isLoading || !ride) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  const initialRegion = {
    latitude: driverLoc?.lat ?? ride.origin_lat,
    longitude: driverLoc?.lng ?? ride.origin_lng,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const statusBg = STATUS_COLORS[rideStatus] ?? "bg-blue-600";
  const statusLabel = STATUS_LABELS[rideStatus] ?? rideStatus;

  return (
    <View className="flex-1">
      {/* Map */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation={isDriver}
        showsMyLocationButton={isDriver}
      >
        {/* Driver live position */}
        {driverLoc && (
          <Marker
            coordinate={{ latitude: driverLoc.lat, longitude: driverLoc.lng }}
            title="Motorista"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View className="bg-blue-700 rounded-full p-2 border-2 border-white shadow">
              <Ionicons name="car" size={18} color="white" />
            </View>
          </Marker>
        )}

        {/* Origin */}
        <Marker
          coordinate={{ latitude: ride.origin_lat, longitude: ride.origin_lng }}
          title="Origem"
          pinColor="#22c55e"
        />

        {/* Destination */}
        <Marker
          coordinate={{ latitude: ride.destination_lat, longitude: ride.destination_lng }}
          title="Destino"
          pinColor="#ef4444"
        />

        {/* Route line */}
        <Polyline
          coordinates={[
            { latitude: ride.origin_lat, longitude: ride.origin_lng },
            { latitude: ride.destination_lat, longitude: ride.destination_lng },
          ]}
          strokeColor="#1d4ed8"
          strokeWidth={3}
          lineDashPattern={[8, 4]}
        />
      </MapView>

      {/* Status banner */}
      <View className={`absolute top-0 left-0 right-0 ${statusBg} py-2 px-4 flex-row items-center justify-between`}>
        <Text className="text-white font-semibold text-sm">{statusLabel}</Text>
        <View className="flex-row items-center gap-1.5">
          <View
            className={`w-2 h-2 rounded-full ${wsStatus === "open" ? "bg-green-300" : "bg-red-300"}`}
          />
          <Text className="text-white text-xs opacity-80">
            {wsStatus === "open" ? "Conectado" : "Offline"}
          </Text>
        </View>
      </View>

      {/* Info + action panel */}
      <SafeAreaView edges={["bottom"]} className="bg-white">
        <View className="px-5 pt-4 pb-2 gap-3">
          {/* Route summary */}
          <View className="flex-row gap-3 items-center">
            <View className="gap-1 items-center">
              <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <View className="w-px h-4 bg-gray-300" />
              <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-gray-700 text-sm" numberOfLines={1}>{ride.origin_address}</Text>
              <Text className="text-gray-400 text-sm" numberOfLines={1}>{ride.destination_address}</Text>
            </View>
            {ride.distance_km && (
              <Text className="text-blue-600 font-bold text-sm">{ride.distance_km.toFixed(1)} km</Text>
            )}
          </View>

          {/* Driver actions */}
          {isDriver && rideStatus === "matched" && (
            <TouchableOpacity
              className="bg-green-600 rounded-2xl py-4 items-center"
              onPress={handleStartRide}
            >
              <Text className="text-white font-bold text-base">Iniciar corrida</Text>
            </TouchableOpacity>
          )}

          {isDriver && rideStatus === "in_progress" && (
            <TouchableOpacity
              className="bg-blue-700 rounded-2xl py-4 items-center"
              onPress={handleCompleteRide}
            >
              <Text className="text-white font-bold text-base">Finalizar corrida</Text>
            </TouchableOpacity>
          )}

          {/* Client info when no driver location yet */}
          {!isDriver && !driverLoc && rideStatus !== "completed" && (
            <View className="flex-row items-center gap-2 bg-yellow-50 rounded-xl px-4 py-3">
              <ActivityIndicator size="small" color="#ca8a04" />
              <Text className="text-yellow-700 text-sm">Aguardando localização do motorista...</Text>
            </View>
          )}

          {rideStatus === "completed" && (
            <View className="gap-2">
              {!isDriver && (
                <TouchableOpacity
                  className="bg-blue-700 rounded-2xl py-3.5 items-center"
                  onPress={() =>
                    router.replace({ pathname: "/ride/review", params: { rideId: id } })
                  }
                >
                  <Text className="text-white font-bold">Avaliar motorista</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="bg-gray-100 rounded-2xl py-3 items-center"
                onPress={() => router.replace("/(tabs)/rides")}
              >
                <Text className="text-gray-600 font-medium">Fechar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
