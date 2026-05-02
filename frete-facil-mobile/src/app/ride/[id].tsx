import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRide, useAcceptOffer, useCancelRide } from "@/hooks/useRides";
import { usePaymentStatus } from "@/hooks/usePayment";
import { useDriverRating } from "@/hooks/useReviews";
import { useMe } from "@/hooks/useAuth";
import type { OfferResponse } from "@/services/rideService";

const CATEGORY_LABELS: Record<string, string> = {
  carreto_simples: "Carreto Simples",
  mudanca_residencial: "Mudança Residencial",
  mudanca_comercial: "Mudança Comercial",
  entrega_rapida: "Entrega Rápida",
  outros: "Outros",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  matched: "Motorista aceito",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
  expired: "Expirado",
};

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: ride, isLoading } = useRide(id!);
  const { data: user } = useMe();
  const acceptOffer = useAcceptOffer(id!);
  const cancelRide = useCancelRide();

  const isClient = ride?.client_id === user?.id;
  const isDriver = user?.role === "driver" || user?.role === "both";
  const isOpen = ride?.status === "open";
  const isMatched = ride?.status === "matched";
  const isActiveRide = isMatched || ride?.status === "in_progress";
  const isDriverOfRide = isDriver && !isClient;

  const { data: payment } = usePaymentStatus(id!, isClient && isMatched);
  const paymentPending = isClient && isMatched && (!payment || payment.status === "pending");

  function handleCancel() {
    Alert.alert("Cancelar frete", "Tem certeza que deseja cancelar?", [
      { text: "Não", style: "cancel" },
      {
        text: "Cancelar frete",
        style: "destructive",
        onPress: () => cancelRide.mutate(id!, { onSuccess: () => router.back() }),
      },
    ]);
  }

  function handleAcceptOffer(offerId: string, price: number) {
    Alert.alert("Aceitar proposta", `Aceitar proposta de R$ ${price.toFixed(2)}?`, [
      { text: "Não", style: "cancel" },
      { text: "Aceitar", onPress: () => acceptOffer.mutate(offerId) },
    ]);
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Corrida não encontrada.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Status */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex-row items-center justify-between">
          <View>
            <Text className="text-gray-500 text-xs">{CATEGORY_LABELS[ride.category]}</Text>
            <Text className="font-bold text-gray-900 text-lg">{STATUS_LABELS[ride.status]}</Text>
          </View>
          {ride.distance_km && (
            <View className="bg-blue-50 rounded-xl px-3 py-2 items-center">
              <Text className="text-blue-700 font-bold">{ride.distance_km.toFixed(1)}</Text>
              <Text className="text-blue-500 text-xs">km</Text>
            </View>
          )}
        </View>

        {/* Route */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 gap-3">
          <View className="flex-row items-start gap-3">
            <View className="w-3 h-3 rounded-full bg-green-500 mt-1" />
            <View className="flex-1">
              <Text className="text-gray-400 text-xs">Origem</Text>
              <Text className="text-gray-800 font-medium">{ride.origin_address}</Text>
            </View>
          </View>
          <View className="ml-1.5 w-px h-4 bg-gray-200" />
          <View className="flex-row items-start gap-3">
            <View className="w-3 h-3 rounded-full bg-red-500 mt-1" />
            <View className="flex-1">
              <Text className="text-gray-400 text-xs">Destino</Text>
              <Text className="text-gray-800 font-medium">{ride.destination_address}</Text>
            </View>
          </View>
        </View>

        {/* Details */}
        {(ride.description || ride.estimated_weight_kg) && (
          <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 gap-2">
            {ride.description && (
              <Text className="text-gray-600 text-sm">{ride.description}</Text>
            )}
            {ride.estimated_weight_kg && (
              <View className="flex-row items-center gap-2">
                <Ionicons name="barbell-outline" size={16} color="#6b7280" />
                <Text className="text-gray-500 text-sm">{ride.estimated_weight_kg} kg estimado</Text>
              </View>
            )}
          </View>
        )}

        {/* Driver: make offer button */}
        {isDriverOfRide && isOpen && (
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 bg-blue-700 rounded-2xl py-4"
            onPress={() =>
              router.push({ pathname: "/ride/make-offer", params: { rideId: id } })
            }
          >
            <Ionicons name="pricetag-outline" size={20} color="white" />
            <Text className="text-white font-bold text-base">Enviar proposta</Text>
          </TouchableOpacity>
        )}

        {/* Client: pay button when matched and payment not done */}
        {paymentPending && (
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 bg-green-600 rounded-2xl py-4"
            onPress={() =>
              router.push({ pathname: "/ride/payment", params: { rideId: id } })
            }
          >
            <Ionicons name="card-outline" size={20} color="white" />
            <Text className="text-white font-bold text-base">Pagar frete</Text>
          </TouchableOpacity>
        )}

        {/* Tracking button — visible when ride is matched or in_progress */}
        {isActiveRide && (
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 bg-green-600 rounded-2xl py-4"
            onPress={() => router.push({ pathname: "/ride/track", params: { id } })}
          >
            <Ionicons name="navigate-outline" size={20} color="white" />
            <Text className="text-white font-bold text-base">
              {isDriverOfRide ? "Navegar / Gerenciar corrida" : "Acompanhar motorista"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Offers list (visible to client) */}
        {isClient && (ride.offers?.length ?? 0) > 0 && (
          <View>
            <Text className="text-gray-700 font-semibold text-base mb-3">
              Propostas ({ride.offers!.length})
            </Text>
            {ride.offers!
              .filter((o) => o.status === "pending" || o.status === "accepted")
              .map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  isAccepted={offer.id === ride.accepted_offer_id?.toString()}
                  canAccept={isOpen}
                  onAccept={() => handleAcceptOffer(offer.id, offer.price)}
                />
              ))}
          </View>
        )}

        {/* Client: cancel */}
        {isClient && isOpen && (
          <TouchableOpacity
            className="rounded-2xl py-3.5 items-center border border-red-200 bg-red-50"
            onPress={handleCancel}
            disabled={cancelRide.isPending}
          >
            <Text className="text-red-600 font-medium">Cancelar frete</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OfferCard({
  offer,
  isAccepted,
  canAccept,
  onAccept,
}: {
  offer: OfferResponse;
  isAccepted: boolean;
  canAccept: boolean;
  onAccept: () => void;
}) {
  const { data: driverRating } = useDriverRating(offer.driver?.id);

  return (
    <View
      className={`bg-white rounded-2xl p-4 mb-3 shadow-sm border ${
        isAccepted ? "border-green-400" : "border-gray-100"
      }`}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-1 mr-2">
          <Text className="font-bold text-gray-900 text-lg">
            R$ {offer.price.toFixed(2)}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
            <Text className="text-gray-500 text-xs">{offer.driver?.name ?? "Motorista"}</Text>
            {driverRating && driverRating.rating_count > 0 && (
              <View className="flex-row items-center gap-0.5">
                <Ionicons name="star" size={11} color="#f59e0b" />
                <Text className="text-amber-600 text-xs font-medium">
                  {driverRating.rating_avg.toFixed(1)}
                </Text>
                <Text className="text-gray-400 text-xs">
                  ({driverRating.rating_count})
                </Text>
              </View>
            )}
          </View>
        </View>
        {isAccepted ? (
          <View className="bg-green-50 rounded-xl px-3 py-1.5 flex-row items-center gap-1">
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
            <Text className="text-green-700 text-xs font-medium">Aceita</Text>
          </View>
        ) : canAccept ? (
          <TouchableOpacity
            className="bg-blue-700 rounded-xl px-4 py-2"
            onPress={onAccept}
          >
            <Text className="text-white font-bold text-sm">Aceitar</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {offer.message && (
        <Text className="text-gray-500 text-sm">{offer.message}</Text>
      )}
    </View>
  );
}
