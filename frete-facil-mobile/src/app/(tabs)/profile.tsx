import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMe, useLogout } from "@/hooks/useAuth";
import { useDriverRating, useDriverReviews } from "@/hooks/useReviews";
import type { ReviewResponse } from "@/services/reviewService";

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={s <= rating ? "star" : "star-outline"}
          size={size}
          color={s <= rating ? "#f59e0b" : "#d1d5db"}
        />
      ))}
    </View>
  );
}

function ReviewItem({ item }: { item: ReviewResponse }) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
      <View className="flex-row items-center justify-between mb-2">
        <StarRow rating={item.rating} />
        <Text className="text-gray-400 text-xs">
          {new Date(item.created_at).toLocaleDateString("pt-BR")}
        </Text>
      </View>
      {item.comment && (
        <Text className="text-gray-600 text-sm">{item.comment}</Text>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const logout = useLogout();
  const { data: user } = useMe();
  const [showReviews, setShowReviews] = useState(false);

  const isDriver = user?.role === "driver" || user?.role === "both";
  const { data: rating } = useDriverRating(isDriver ? user?.id : undefined);
  const { data: reviews = [], isLoading: reviewsLoading } = useDriverReviews(
    showReviews && isDriver ? user?.id : undefined
  );

  const menuItems = [
    { icon: "person-outline", label: "Meus dados", onPress: () => {} },
    ...(isDriver
      ? [
          {
            icon: "shield-checkmark-outline",
            label: "Verificação de motorista",
            onPress: () => router.push("/(driver)/verification"),
          },
          {
            icon: "star-outline",
            label: "Minhas avaliações",
            onPress: () => setShowReviews(true),
          },
        ]
      : []),
    { icon: "help-circle-outline", label: "Ajuda e suporte", onPress: () => {} },
    {
      icon: "document-text-outline",
      label: "Termos de uso",
      onPress: () => {},
    },
    { icon: "shield-outline", label: "Privacidade (LGPD)", onPress: () => {} },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView>
        {/* Header */}
        <View className="bg-blue-700 px-6 pt-6 pb-10 items-center">
          <View className="w-20 h-20 bg-blue-500 rounded-full items-center justify-center mb-3">
            <Ionicons name="person" size={40} color="white" />
          </View>
          <Text className="text-white text-xl font-bold">{user?.name ?? "..."}</Text>
          <Text className="text-blue-200 text-sm mt-0.5">{user?.email ?? ""}</Text>

          {/* Driver rating badge */}
          {isDriver && rating && rating.rating_count > 0 && (
            <View className="flex-row items-center gap-2 mt-3 bg-blue-600 rounded-full px-4 py-1.5">
              <Ionicons name="star" size={14} color="#fbbf24" />
              <Text className="text-white font-bold text-sm">
                {rating.rating_avg.toFixed(1)}
              </Text>
              <Text className="text-blue-200 text-xs">
                ({rating.rating_count} avaliação{rating.rating_count !== 1 ? "ões" : ""})
              </Text>
            </View>
          )}

          {isDriver && rating && rating.rating_count === 0 && (
            <View className="mt-3 bg-blue-600 rounded-full px-4 py-1.5">
              <Text className="text-blue-200 text-xs">Sem avaliações ainda</Text>
            </View>
          )}
        </View>

        <View className="px-5 -mt-4">
          <View className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-4">
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.label}
                className={`flex-row items-center px-5 py-4 ${
                  index < menuItems.length - 1 ? "border-b border-gray-100" : ""
                }`}
                onPress={item.onPress}
              >
                <Ionicons name={item.icon as any} size={22} color="#4b5563" />
                <Text className="flex-1 text-gray-700 font-medium ml-3">{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            className="bg-red-50 rounded-2xl py-4 items-center border border-red-100 mb-8"
            onPress={logout}
          >
            <Text className="text-red-600 font-bold">Sair da conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Reviews Modal */}
      <Modal visible={showReviews} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
            <Text className="text-gray-900 font-bold text-lg">Minhas avaliações</Text>
            <TouchableOpacity onPress={() => setShowReviews(false)}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {rating && rating.rating_count > 0 && (
            <View className="mx-5 mt-4 bg-white rounded-2xl p-4 border border-gray-100 flex-row items-center gap-4">
              <View className="items-center">
                <Text className="text-4xl font-bold text-gray-900">
                  {rating.rating_avg.toFixed(1)}
                </Text>
                <StarRow rating={Math.round(rating.rating_avg)} size={14} />
                <Text className="text-gray-400 text-xs mt-1">
                  {rating.rating_count} avaliação{rating.rating_count !== 1 ? "ões" : ""}
                </Text>
              </View>
              <View className="flex-1 gap-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviews.filter((r) => r.rating === star).length;
                  const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                  return (
                    <View key={star} className="flex-row items-center gap-2">
                      <Text className="text-gray-400 text-xs w-3">{star}</Text>
                      <View className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <View
                          className="h-2 bg-amber-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </View>
                      <Text className="text-gray-400 text-xs w-6">{count}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {reviewsLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#1d4ed8" />
            </View>
          ) : reviews.length === 0 ? (
            <View className="flex-1 items-center justify-center gap-3">
              <Ionicons name="star-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-500">Nenhuma avaliação ainda</Text>
            </View>
          ) : (
            <FlatList
              data={reviews}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => <ReviewItem item={item} />}
              contentContainerStyle={{ padding: 20 }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
