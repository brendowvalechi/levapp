import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-primary-700">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-white text-5xl font-bold mb-2">🚚</Text>
        <Text className="text-white text-4xl font-bold mb-2">Levapp</Text>
        <Text className="text-blue-200 text-lg text-center mb-16">
          Conectamos você com transportadores de confiança na sua cidade
        </Text>

        <TouchableOpacity
          className="w-full bg-white rounded-2xl py-4 items-center mb-4"
          onPress={() => router.push("/(auth)/login")}
        >
          <Text className="text-primary-700 font-bold text-lg">Entrar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full border-2 border-white rounded-2xl py-4 items-center"
          onPress={() => router.push("/(auth)/register")}
        >
          <Text className="text-white font-bold text-lg">Criar conta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
