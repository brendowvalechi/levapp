import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useVerificationStatus, useVehicles } from "@/hooks/useDocuments";

const STATUS_CONFIG = {
  pending: { label: "Pendente", color: "bg-yellow-100", textColor: "text-yellow-700", icon: "time-outline" as const },
  approved: { label: "Aprovado", color: "bg-green-100", textColor: "text-green-700", icon: "checkmark-circle-outline" as const },
  rejected: { label: "Rejeitado", color: "bg-red-100", textColor: "text-red-700", icon: "close-circle-outline" as const },
};

const DOCUMENT_LABELS: Record<string, string> = {
  cnh_number: "Número da CNH",
  cnh_front: "Foto frente da CNH",
  cnh_back: "Foto verso da CNH",
  selfie: "Selfie com documento",
};

export default function VerificationScreen() {
  const router = useRouter();
  const { data: status, isLoading } = useVerificationStatus();
  const { data: vehicles } = useVehicles();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  const cfg = STATUS_CONFIG[status?.status ?? "pending"];

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Status Card */}
        <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <View className="flex-row items-center gap-3 mb-3">
            <View className={`${cfg.color} rounded-full p-2`}>
              <Ionicons name={cfg.icon} size={22} color="#374151" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-500 text-xs">Status da verificação</Text>
              <Text className={`font-bold text-lg ${cfg.textColor}`}>{cfg.label}</Text>
            </View>
          </View>

          {status?.status === "rejected" && status.rejection_reason && (
            <View className="bg-red-50 rounded-xl p-3 mt-1">
              <Text className="text-red-600 text-sm">{status.rejection_reason}</Text>
            </View>
          )}

          {status?.is_complete && status.status === "pending" && (
            <Text className="text-gray-500 text-sm mt-2">
              Documentos enviados — aguardando análise da equipe Levapp.
            </Text>
          )}
        </View>

        {/* Missing documents */}
        {(status?.missing_documents?.length ?? 0) > 0 && (
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <Text className="font-semibold text-gray-800 mb-3">Documentos pendentes</Text>
            {status!.missing_documents.map((doc) => (
              <View key={doc} className="flex-row items-center gap-2 py-1.5">
                <Ionicons name="alert-circle-outline" size={16} color="#f59e0b" />
                <Text className="text-gray-600 text-sm">{DOCUMENT_LABELS[doc] ?? doc}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Upload actions */}
        <Text className="text-gray-700 font-semibold text-base mt-2">Enviar documentos</Text>

        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <TouchableOpacity
            className="flex-row items-center px-5 py-4 border-b border-gray-100"
            onPress={() => router.push("/(driver)/upload-cnh")}
          >
            <Ionicons name="card-outline" size={22} color="#1d4ed8" />
            <Text className="flex-1 text-gray-700 font-medium ml-3">CNH (frente e verso)</Text>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center px-5 py-4"
            onPress={() => router.push("/(driver)/upload-selfie")}
          >
            <Ionicons name="camera-outline" size={22} color="#1d4ed8" />
            <Text className="flex-1 text-gray-700 font-medium ml-3">Selfie com documento</Text>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Vehicles */}
        <Text className="text-gray-700 font-semibold text-base mt-2">Veículos</Text>

        {vehicles?.map((vehicle) => (
          <View
            key={vehicle.id}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex-row items-center"
          >
            <View className="bg-blue-50 rounded-xl p-2 mr-3">
              <Ionicons name="car-outline" size={20} color="#1d4ed8" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-gray-800">
                {vehicle.brand} {vehicle.model}
              </Text>
              <Text className="text-gray-500 text-xs">{vehicle.plate} · {vehicle.year}</Text>
            </View>
            {!vehicle.crlv_url && (
              <TouchableOpacity
                className="bg-yellow-50 px-3 py-1.5 rounded-xl"
                onPress={() =>
                  router.push({ pathname: "/(driver)/upload-crlv", params: { vehicleId: vehicle.id, plate: vehicle.plate } })
                }
              >
                <Text className="text-yellow-700 text-xs font-medium">Enviar CRLV</Text>
              </TouchableOpacity>
            )}
            {vehicle.crlv_url && (
              <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
            )}
          </View>
        ))}

        <TouchableOpacity
          className="flex-row items-center justify-center gap-2 bg-blue-700 rounded-2xl py-4 mt-1"
          onPress={() => router.push("/(driver)/add-vehicle")}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text className="text-white font-bold text-base">Cadastrar veículo</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
