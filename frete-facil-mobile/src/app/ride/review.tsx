import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCreateReview } from "@/hooks/useReviews";

const STAR_LABELS = ["", "Ruim", "Regular", "Bom", "Ótimo", "Excelente"];

export default function ReviewScreen() {
  const { rideId, driverName } = useLocalSearchParams<{
    rideId: string;
    driverName?: string;
  }>();
  const router = useRouter();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const createReview = useCreateReview(rideId!);

  function handleSubmit() {
    if (rating === 0) {
      Alert.alert("Avaliação necessária", "Selecione uma nota de 1 a 5 estrelas.");
      return;
    }
    createReview.mutate(
      { rating, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          Alert.alert("Obrigado!", "Sua avaliação foi enviada.", [
            { text: "OK", onPress: () => router.replace("/(tabs)/rides") },
          ]);
        },
        onError: (e: any) => {
          const msg = e?.response?.data?.detail ?? "Não foi possível enviar a avaliação.";
          Alert.alert("Erro", msg);
        },
      }
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          {/* Header */}
          <View className="items-center gap-3 py-4">
            <View className="w-16 h-16 rounded-full bg-blue-100 items-center justify-center">
              <Ionicons name="person" size={32} color="#1d4ed8" />
            </View>
            <Text className="text-gray-900 font-bold text-xl">
              {driverName ? `Avaliar ${driverName}` : "Avaliar corrida"}
            </Text>
            <Text className="text-gray-500 text-sm text-center">
              Como foi sua experiência com este motorista?
            </Text>
          </View>

          {/* Stars */}
          <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 items-center gap-4">
            <View className="flex-row gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={44}
                    color={star <= rating ? "#f59e0b" : "#d1d5db"}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text className="text-amber-600 font-semibold text-base">
                {STAR_LABELS[rating]}
              </Text>
            )}
          </View>

          {/* Comment */}
          <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 gap-2">
            <Text className="text-gray-700 font-medium">Comentário (opcional)</Text>
            <TextInput
              className="text-gray-800 text-sm min-h-[100px]"
              multiline
              placeholder="Conte como foi o serviço..."
              placeholderTextColor="#9ca3af"
              value={comment}
              onChangeText={setComment}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text className="text-gray-400 text-xs text-right">{comment.length}/500</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            className={`rounded-2xl py-4 items-center ${
              rating === 0 ? "bg-gray-200" : "bg-blue-700"
            }`}
            onPress={handleSubmit}
            disabled={rating === 0 || createReview.isPending}
          >
            {createReview.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  rating === 0 ? "text-gray-400" : "text-white"
                }`}
              >
                Enviar avaliação
              </Text>
            )}
          </TouchableOpacity>

          {/* Skip */}
          <TouchableOpacity
            className="items-center py-2"
            onPress={() => router.replace("/(tabs)/rides")}
          >
            <Text className="text-gray-400 text-sm">Pular por agora</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
