import { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMyRides, useOpenRides } from "@/hooks/useRides";
import { useMe } from "@/hooks/useAuth";
import { RideCardSkeleton } from "@/components/SkeletonCard";
import type { RideResponse, RideStatus } from "@/services/rideService";

const STATUS_LABELS: Record<RideStatus, string> = {
  open: "Aberto",
  matched: "Motorista aceito",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
  expired: "Expirado",
};

const STATUS_COLORS: Record<RideStatus, string> = {
  open: "bg-blue-50 text-blue-700",
  matched: "bg-green-50 text-green-700",
  in_progress: "bg-yellow-50 text-yellow-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-50 text-red-600",
  expired: "bg-gray-100 text-gray-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  carreto_simples: "Carreto",
  mudanca_residencial: "Mudança Residencial",
  mudanca_comercial: "Mudança Comercial",
  entrega_rapida: "Entrega Rápida",
  outros: "Outros",
};

export default function RidesScreen() {
  const router = useRouter();
  const { data: user } = useMe();
  const isDriver = user?.role === "driver" || user?.role === "both";
  const [tab, setTab] = useState<"mine" | "open">("mine");

  const myRides = useMyRides();
  const openRides = useOpenRides();

  const rides = tab === "mine" ? myRides.data : openRides.data;
  const isLoading = tab === "mine" ? myRides.isLoading : openRides.isLoading;
  const refetch = tab === "mine" ? myRides.refetch : openRides.refetch;

  function RideCard({ ride }: { ride: RideResponse }) {
    return (
      <TouchableOpacity
        className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100"
        onPress={() => router.push({ pathname: "/ride/[id]", params: { id: ride.id } })}
        activeOpacity={0.8}
      >
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1">
            <Text className="text-gray-500 text-xs">{CATEGORY_LABELS[ride.category]}</Text>
            {ride.distance_km && (
              <Text className="text-blue-600 text-xs font-medium">{ride.distance_km.toFixed(1)} km</Text>
            )}
          </View>
          <View className={`px-2.5 py-1 rounded-lg ${STATUS_COLORS[ride.status]}`}>
            <Text className={`text-xs font-medium`}>{STATUS_LABELS[ride.status]}</Text>
          </View>
        </View>

        <View className="gap-1.5">
          <View className="flex-row items-center gap-2">
            <View className="w-2.5 h-2.5 rounded-full bg-green-500 mt-0.5" />
            <Text className="text-gray-700 text-sm flex-1" numberOfLines={1}>
              {ride.origin_address}
            </Text>
          </View>
          <View className="ml-1.5 w-px h-3 bg-gray-200" />
          <View className="flex-row items-center gap-2">
            <View className="w-2.5 h-2.5 rounded-full bg-red-500 mt-0.5" />
            <Text className="text-gray-700 text-sm flex-1" numberOfLines={1}>
              {ride.destination_address}
            </Text>
          </View>
        </View>

        {ride.offers_count > 0 && (
          <View className="mt-3 pt-3 border-t border-gray-100 flex-row items-center gap-1">
            <Ionicons name="pricetag-outline" size={14} color="#1d4ed8" />
            <Text className="text-blue-600 text-xs font-medium">
              {ride.offers_count} proposta{ride.offers_count !== 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-5 pb-2">
        <Text className="text-2xl font-bold text-gray-900">Corridas</Text>

        {isDriver && (
          <View className="flex-row mt-4 bg-gray-100 rounded-xl p-1 gap-1">
            <TouchableOpacity
              className={`flex-1 py-2 rounded-lg items-center ${tab === "mine" ? "bg-white shadow-sm" : ""}`}
              onPress={() => setTab("mine")}
            >
              <Text className={`text-sm font-medium ${tab === "mine" ? "text-blue-700" : "text-gray-500"}`}>
                Minhas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-2 rounded-lg items-center ${tab === "open" ? "bg-white shadow-sm" : ""}`}
              onPress={() => setTab("open")}
            >
              <Text className={`text-sm font-medium ${tab === "open" ? "text-blue-700" : "text-gray-500"}`}>
                Disponíveis
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isLoading ? (
        <View className="px-5 pt-2">
          {[1, 2, 3].map((k) => <RideCardSkeleton key={k} />)}
        </View>
      ) : (
        <FlatList
          data={rides ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <RideCard ride={item} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          ListEmptyComponent={
            <View className="bg-white rounded-2xl p-8 items-center border border-gray-100">
              <Ionicons name="receipt-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-500 font-medium mt-3">
                {tab === "open" ? "Nenhuma corrida disponível" : "Nenhuma corrida encontrada"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
