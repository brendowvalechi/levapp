import { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVerifyOtp, useResendOtp } from "@/hooks/useAuth";

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputs = useRef<(TextInput | null)[]>([]);

  const verifyOtp = useVerifyOtp();
  const resendOtp = useResendOtp();

  const handleChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleVerify = () => {
    verifyOtp.mutate({ phone: phone ?? "", code: otp.join("") });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-8">
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <Text className="text-primary-700 text-base">← Voltar</Text>
        </TouchableOpacity>

        <Text className="text-3xl font-bold text-gray-900 mb-2">Verificar telefone</Text>
        <Text className="text-gray-500 mb-2">Código enviado para</Text>
        <Text className="text-gray-900 font-semibold mb-8">{phone}</Text>

        <View className="flex-row justify-between mb-8">
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputs.current[index] = ref; }}
              className="w-12 h-14 border-2 border-gray-300 rounded-xl text-center text-2xl font-bold"
              maxLength={1}
              keyboardType="number-pad"
              value={digit}
              onChangeText={(v) => handleChange(v, index)}
            />
          ))}
        </View>

        {verifyOtp.isError && (
          <View className="bg-red-50 rounded-xl px-4 py-3 mb-4">
            <Text className="text-red-600 text-sm">
              {(verifyOtp.error as any)?.response?.data?.detail ?? "Código inválido ou expirado."}
            </Text>
          </View>
        )}

        <TouchableOpacity
          className={`rounded-2xl py-4 items-center ${
            otp.some((d) => !d) || verifyOtp.isPending ? "bg-primary-400" : "bg-primary-700"
          }`}
          onPress={handleVerify}
          disabled={otp.some((d) => !d) || verifyOtp.isPending}
        >
          {verifyOtp.isPending
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-bold text-lg">Verificar</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-4 items-center"
          onPress={() => resendOtp.mutate(phone ?? "")}
          disabled={resendOtp.isPending}
        >
          <Text className="text-primary-700">
            {resendOtp.isPending ? "Enviando..." : "Reenviar código"}
          </Text>
        </TouchableOpacity>

        {resendOtp.isSuccess && (
          <Text className="text-green-600 text-center mt-2 text-sm">Código reenviado!</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
