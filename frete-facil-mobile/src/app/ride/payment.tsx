import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Linking,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCreatePayment, usePaymentStatus } from "@/hooks/usePayment";
import type { PaymentMethod } from "@/services/paymentService";

export default function PaymentScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const router = useRouter();

  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [paymentStarted, setPaymentStarted] = useState(false);

  const createPayment = useCreatePayment(rideId!);
  const { data: payment, isLoading: polling } = usePaymentStatus(rideId!, paymentStarted);

  const isPaid = payment?.status === "approved" || payment?.status === "in_escrow";

  useEffect(() => {
    if (isPaid) {
      Alert.alert("Pagamento confirmado!", "Seu frete está confirmado.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [isPaid]);

  function handlePay() {
    createPayment.mutate(method, {
      onSuccess: async (data) => {
        setPaymentStarted(true);
        if (method === "checkout_pro" && data.checkout_url) {
          await Linking.openURL(data.checkout_url);
        }
      },
      onError: () => {
        Alert.alert("Erro", "Não foi possível iniciar o pagamento. Tente novamente.");
      },
    });
  }

  async function handleCopyPix() {
    if (!payment?.pix_copy_paste) return;
    await Share.share({ message: payment.pix_copy_paste });
  }

  const isCreating = createPayment.isPending;
  const showPixScreen = paymentStarted && method === "pix" && payment;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Header */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <Text className="text-gray-500 text-xs mb-1">Valor do frete</Text>
          <Text className="text-3xl font-bold text-gray-900">
            R$ {payment?.amount.toFixed(2) ?? "—"}
          </Text>
        </View>

        {/* Method selector — shown before paying */}
        {!paymentStarted && (
          <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 gap-3">
            <Text className="text-gray-700 font-semibold">Forma de pagamento</Text>

            <TouchableOpacity
              className={`flex-row items-center gap-3 rounded-xl p-3 border ${
                method === "pix" ? "border-blue-600 bg-blue-50" : "border-gray-200"
              }`}
              onPress={() => setMethod("pix")}
            >
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                method === "pix" ? "border-blue-600" : "border-gray-300"
              }`}>
                {method === "pix" && <View className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
              </View>
              <Ionicons name="qr-code-outline" size={20} color={method === "pix" ? "#1d4ed8" : "#6b7280"} />
              <Text className={`font-medium ${method === "pix" ? "text-blue-700" : "text-gray-700"}`}>
                Pix (instantâneo)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-row items-center gap-3 rounded-xl p-3 border ${
                method === "checkout_pro" ? "border-blue-600 bg-blue-50" : "border-gray-200"
              }`}
              onPress={() => setMethod("checkout_pro")}
            >
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                method === "checkout_pro" ? "border-blue-600" : "border-gray-300"
              }`}>
                {method === "checkout_pro" && <View className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
              </View>
              <Ionicons name="card-outline" size={20} color={method === "checkout_pro" ? "#1d4ed8" : "#6b7280"} />
              <Text className={`font-medium ${method === "checkout_pro" ? "text-blue-700" : "text-gray-700"}`}>
                Cartão / outros (Mercado Pago)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-blue-700 rounded-2xl py-4 items-center mt-2"
              onPress={handlePay}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">
                  {method === "pix" ? "Gerar QR Code Pix" : "Pagar com Mercado Pago"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Pix QR screen */}
        {showPixScreen && !isPaid && (
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 items-center gap-4">
            <Text className="text-gray-700 font-semibold text-base">Escaneie o QR Code</Text>

            {payment.pix_qr_code_base64 ? (
              <Image
                source={{ uri: `data:image/png;base64,${payment.pix_qr_code_base64}` }}
                style={{ width: 220, height: 220 }}
                resizeMode="contain"
              />
            ) : (
              <View className="w-56 h-56 bg-gray-100 rounded-xl items-center justify-center">
                <Ionicons name="qr-code-outline" size={80} color="#9ca3af" />
                <Text className="text-gray-400 text-xs mt-2">QR Code indisponível</Text>
              </View>
            )}

            {payment.pix_copy_paste && (
              <TouchableOpacity
                className="flex-row items-center gap-2 bg-gray-100 rounded-xl px-4 py-3 w-full justify-center"
                onPress={handleCopyPix}
              >
                <Ionicons name="copy-outline" size={18} color="#374151" />
                <Text className="text-gray-700 font-medium">Copiar código Pix</Text>
              </TouchableOpacity>
            )}

            {/* Polling indicator */}
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#1d4ed8" />
              <Text className="text-gray-500 text-sm">Aguardando confirmação do pagamento...</Text>
            </View>
          </View>
        )}

        {/* Success */}
        {isPaid && (
          <View className="bg-green-50 rounded-2xl p-5 border border-green-200 items-center gap-3">
            <Ionicons name="checkmark-circle" size={56} color="#16a34a" />
            <Text className="text-green-800 font-bold text-lg">Pagamento confirmado!</Text>
            <Text className="text-green-700 text-sm text-center">
              O motorista foi notificado. Seu frete está em andamento.
            </Text>
            <TouchableOpacity
              className="bg-green-600 rounded-2xl py-3 px-8 mt-1"
              onPress={() => router.back()}
            >
              <Text className="text-white font-bold">Voltar para o frete</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
