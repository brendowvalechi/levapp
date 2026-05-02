import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useCreateRide } from "@/hooks/useRides";
import type { RideCategory } from "@/services/rideService";

const CATEGORIES: { value: RideCategory; label: string; icon: string }[] = [
  { value: "carreto_simples", label: "Carreto", icon: "cube-outline" },
  { value: "mudanca_residencial", label: "Mudança Residencial", icon: "home-outline" },
  { value: "mudanca_comercial", label: "Mudança Comercial", icon: "business-outline" },
  { value: "entrega_rapida", label: "Entrega Rápida", icon: "flash-outline" },
  { value: "outros", label: "Outros", icon: "ellipsis-horizontal-outline" },
];

// Coordenadas padrão: Uberlândia-MG. Sprint 5 usará Google Places + GPS real.
const UDI_LAT = -18.9188;
const UDI_LNG = -48.2769;

export default function NewRideScreen() {
  const createRide = useCreateRide();
  const [category, setCategory] = useState<RideCategory>("carreto_simples");
  const [originAddress, setOriginAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [description, setDescription] = useState("");
  const [weightKg, setWeightKg] = useState("");

  async function handleSubmit() {
    if (!originAddress.trim() || !destinationAddress.trim()) {
      Alert.alert("Atenção", "Preencha os endereços de origem e destino.");
      return;
    }
    try {
      await createRide.mutateAsync({
        origin_address: originAddress.trim(),
        origin_lat: UDI_LAT,
        origin_lng: UDI_LNG,
        destination_address: destinationAddress.trim(),
        destination_lat: UDI_LAT - 0.01,
        destination_lng: UDI_LNG - 0.02,
        category,
        description: description.trim() || undefined,
        estimated_weight_kg: weightKg ? parseInt(weightKg) : undefined,
      });
    } catch {
      Alert.alert("Erro", "Não foi possível publicar a levagem. Tente novamente.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <View>
          <Text className="text-2xl font-bold text-gray-900">Nova Levagem</Text>
          <Text className="text-gray-500 text-sm mt-1">
            Preencha os dados e receba propostas de motoristas
          </Text>
        </View>

        {/* Categoria */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <Text className="text-gray-700 font-semibold mb-3">Tipo de serviço</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.value}
                onPress={() => setCategory(c.value)}
                className={`flex-row items-center gap-2 px-3 py-2 rounded-xl border ${
                  category === c.value ? "bg-blue-700 border-blue-700" : "bg-white border-gray-200"
                }`}
              >
                <Ionicons
                  name={c.icon as any}
                  size={14}
                  color={category === c.value ? "white" : "#6b7280"}
                />
                <Text
                  className={`text-sm font-medium ${
                    category === c.value ? "text-white" : "text-gray-600"
                  }`}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Endereços */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 gap-4">
          <View>
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-3 h-3 rounded-full bg-green-500" />
              <Text className="text-gray-700 font-medium">Endereço de origem</Text>
            </View>
            <TextInput
              className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800 border border-gray-200"
              placeholder="Rua, número, bairro..."
              value={originAddress}
              onChangeText={setOriginAddress}
              autoCapitalize="words"
            />
          </View>
          <View className="h-px bg-gray-100" />
          <View>
            <View className="flex-row items-center gap-2 mb-2">
              <View className="w-3 h-3 rounded-full bg-red-500" />
              <Text className="text-gray-700 font-medium">Endereço de destino</Text>
            </View>
            <TextInput
              className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800 border border-gray-200"
              placeholder="Rua, número, bairro..."
              value={destinationAddress}
              onChangeText={setDestinationAddress}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Detalhes */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 gap-4">
          <View>
            <Text className="text-gray-600 text-sm mb-1">Descrição (opcional)</Text>
            <TextInput
              className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800 border border-gray-200"
              placeholder="Descreva o que será transportado..."
              multiline
              numberOfLines={3}
              style={{ textAlignVertical: "top", minHeight: 80 }}
              value={description}
              onChangeText={setDescription}
            />
          </View>
          <View>
            <Text className="text-gray-600 text-sm mb-1">Peso estimado (kg)</Text>
            <TextInput
              className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800 border border-gray-200"
              placeholder="Ex: 200"
              keyboardType="numeric"
              value={weightKg}
              onChangeText={setWeightKg}
            />
          </View>
        </View>

        <TouchableOpacity
          className={`rounded-2xl py-4 items-center ${
            createRide.isPending ? "bg-blue-400" : "bg-blue-700"
          }`}
          onPress={handleSubmit}
          disabled={createRide.isPending}
        >
          {createRide.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">Publicar levagem</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
