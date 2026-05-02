import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useConversations } from "@/hooks/useChat";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ConversationResponse } from "@/services/chatService";

export default function ChatScreen() {
  const router = useRouter();
  const { data: conversations, isLoading, refetch } = useConversations();

  function ConversationCard({ conv }: { conv: ConversationResponse }) {
    const hasUnread = conv.unread_count > 0;
    return (
      <TouchableOpacity
        className="bg-white px-5 py-4 flex-row items-center gap-3 border-b border-gray-100"
        onPress={() =>
          router.push({ pathname: "/chat/[rideId]", params: { rideId: conv.ride_id } })
        }
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center shrink-0">
          <Ionicons name="person" size={22} color="#1d4ed8" />
        </View>

        {/* Content */}
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center justify-between">
            <Text
              className={`text-gray-900 text-base ${hasUnread ? "font-bold" : "font-medium"}`}
              numberOfLines={1}
            >
              {conv.other_user_name}
            </Text>
            {conv.last_message_at && (
              <Text className="text-gray-400 text-xs shrink-0 ml-2">
                {formatDistanceToNow(new Date(conv.last_message_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </Text>
            )}
          </View>
          <View className="flex-row items-center justify-between mt-0.5">
            <Text
              className={`text-sm flex-1 ${hasUnread ? "text-gray-700 font-medium" : "text-gray-400"}`}
              numberOfLines={1}
            >
              {conv.last_message ?? "Nenhuma mensagem ainda"}
            </Text>
            {hasUnread && (
              <View className="bg-blue-700 rounded-full min-w-[20px] h-5 items-center justify-center px-1.5 ml-2">
                <Text className="text-white text-xs font-bold">
                  {conv.unread_count > 9 ? "9+" : conv.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-5 pb-3 bg-gray-50">
        <Text className="text-2xl font-bold text-gray-900">Mensagens</Text>
      </View>

      <View className="flex-1 bg-white">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-400">Carregando...</Text>
          </View>
        ) : (
          <FlatList
            data={conversations ?? []}
            keyExtractor={(c) => c.ride_id}
            renderItem={({ item }) => <ConversationCard conv={item} />}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
            ListEmptyComponent={
              <View className="items-center justify-center pt-16 px-8 gap-3">
                <View className="bg-gray-100 rounded-full p-6">
                  <Ionicons name="chatbubbles-outline" size={40} color="#9ca3af" />
                </View>
                <Text className="text-gray-500 font-medium text-center">
                  Nenhuma conversa ainda
                </Text>
                <Text className="text-gray-400 text-sm text-center">
                  O chat aparece aqui quando uma proposta for aceita
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
