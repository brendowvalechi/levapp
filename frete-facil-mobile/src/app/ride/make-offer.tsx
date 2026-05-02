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
import { useLocalSearchParams } from "expo-router";
import { useCreateOffer } from "@/hooks/useRides";

export default function MakeOfferScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const createOffer = useCreateOffer(rideId!);
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    const priceNum = parseFloat(price.replace(",", "."));
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("Atenção", "Informe um valor válido.");
      return;
    }
    try {
      await createOffer.mutateAsync({ price: priceNum, message: message.trim() || undefined });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail === "Você já enviou uma proposta para esta corrida"
          ? "Você já enviou uma proposta para este frete."
          : "Não foi possível enviar a proposta.";
      Alert.alert("Erro", msg);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <View className="bg-blue-50 rounded-2xl p-4">
          <Text className="text-blue-800 text-sm">
            Defina um valor justo para conquistar o cliente. A proposta mais competitiva tem mais chances de ser aceita.
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 gap-4">
          <View>
            <Text className="text-gray-700 font-semibold mb-2">Valor da proposta (R$) *</Text>
            <View className="flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 gap-2">
              <Text className="text-gray-500 font-medium">R$</Text>
              <TextInput
                className="flex-1 text-gray-800 text-lg font-semibold"
                placeholder="0,00"
                keyboardType="decimal-pad"
                value={price}
                onChangeText={setPrice}
              />
            </View>
          </View>

          <View>
            <Text className="text-gray-700 font-semibold mb-2">Mensagem (opcional)</Text>
            <TextInput
              className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800 border border-gray-200"
              placeholder="Ex: Tenho caminhonete disponível agora, posso ir em 30 min..."
              multiline
              numberOfLines={4}
              style={{ textAlignVertical: "top", minHeight: 100 }}
              maxLength={500}
              value={message}
              onChangeText={setMessage}
            />
            <Text className="text-gray-400 text-xs text-right mt-1">{message.length}/500</Text>
          </View>
        </View>

        <TouchableOpacity
          className={`rounded-2xl py-4 items-center ${
            createOffer.isPending ? "bg-blue-400" : "bg-blue-700"
          }`}
          onPress={handleSubmit}
          disabled={createOffer.isPending}
        >
          {createOffer.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">Enviar proposta</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
