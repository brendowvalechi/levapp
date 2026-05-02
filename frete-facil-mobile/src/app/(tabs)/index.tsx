import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="bg-primary-700 px-6 pt-4 pb-8">
          <Text className="text-blue-200 text-sm">Bem-vindo,</Text>
          <Text className="text-white text-2xl font-bold">Brendow</Text>
        </View>

        {/* CTA */}
        <View className="px-6 -mt-4">
          <TouchableOpacity
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
            onPress={() => router.push("/(tabs)/new-ride")}
          >
            <View className="flex-row items-center">
              <View className="bg-primary-100 rounded-xl p-3 mr-4">
                <Ionicons name="cube-outline" size={28} color="#1d4ed8" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-lg">Solicitar Levagem</Text>
                <Text className="text-gray-500 text-sm">Receba propostas em minutos</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Status cards */}
        <View className="px-6 mt-6">
          <Text className="text-gray-700 font-bold text-lg mb-3">Resumo</Text>
          <View className="flex-row gap-3">
            {[
              { label: "Corridas", value: "0", icon: "car", color: "bg-blue-100", text: "text-blue-700" },
              { label: "Avaliação", value: "—", icon: "star", color: "bg-yellow-100", text: "text-yellow-700" },
            ].map((card) => (
              <View key={card.label} className={`flex-1 ${card.color} rounded-2xl p-4`}>
                <Ionicons name={card.icon as any} size={24} color="#374151" />
                <Text className={`text-2xl font-bold mt-2 ${card.text}`}>{card.value}</Text>
                <Text className="text-gray-500 text-sm">{card.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent rides placeholder */}
        <View className="px-6 mt-6 mb-4">
          <Text className="text-gray-700 font-bold text-lg mb-3">Últimas corridas</Text>
          <View className="bg-white rounded-2xl p-6 items-center border border-gray-100">
            <Ionicons name="car-outline" size={48} color="#d1d5db" />
            <Text className="text-gray-400 mt-2">Nenhuma corrida ainda</Text>
            <Text className="text-gray-400 text-sm">Solicite sua primeira levagem!</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
