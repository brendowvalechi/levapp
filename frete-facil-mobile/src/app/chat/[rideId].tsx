import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useMessages, useChatSocket } from "@/hooks/useChat";
import { useMe } from "@/hooks/useAuth";
import { chatService, MessageResponse } from "@/services/chatService";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ChatRoomScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const navigation = useNavigation();
  const { data: me } = useMe();
  const { data: initialMessages, isLoading } = useMessages(rideId!);
  const { status: wsStatus, sendMessage, sendReadAck } = useChatSocket(rideId!);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const messages: MessageResponse[] = initialMessages ?? [];

  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Mark messages as read when screen opens
  useEffect(() => {
    if (rideId) {
      chatService.markRead(rideId).catch(() => {});
      sendReadAck();
    }
  }, [rideId, sendReadAck]);

  // Update header title with WS status indicator
  useEffect(() => {
    const icons: Record<string, string> = {
      open: "● ",
      connecting: "◌ ",
      closed: "",
      error: "",
    };
    navigation.setOptions({
      title: `${icons[wsStatus] ?? ""}Chat`,
    });
  }, [wsStatus, navigation]);

  async function handleSend() {
    const content = input.trim();
    if (!content) return;

    setInput("");

    // Try WebSocket first, fall back to REST
    const sentViaWs = sendMessage(content);
    if (!sentViaWs) {
      setSending(true);
      try {
        await chatService.sendMessage(rideId!, content);
      } catch {
        Alert.alert("Erro", "Não foi possível enviar a mensagem.");
        setInput(content); // restore
      } finally {
        setSending(false);
      }
    }
  }

  function MessageBubble({ msg }: { msg: MessageResponse }) {
    const isMe = msg.sender_id === me?.id;
    return (
      <View className={`flex-row mb-2 ${isMe ? "justify-end" : "justify-start"}`}>
        <View
          className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
            isMe
              ? "bg-blue-700 rounded-br-sm"
              : "bg-white border border-gray-100 rounded-bl-sm shadow-sm"
          }`}
        >
          {!isMe && (
            <Text className="text-blue-600 font-semibold text-xs mb-1">
              {msg.sender_name}
            </Text>
          )}
          <Text className={`text-sm leading-5 ${isMe ? "text-white" : "text-gray-800"}`}>
            {msg.content}
          </Text>
          <View className="flex-row items-center justify-end gap-1 mt-1">
            <Text className={`text-xs ${isMe ? "text-blue-200" : "text-gray-400"}`}>
              {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
            </Text>
            {isMe && (
              <Ionicons
                name={msg.is_read ? "checkmark-done" : "checkmark"}
                size={12}
                color={msg.is_read ? "#bfdbfe" : "#93c5fd"}
              />
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        {/* Connection banner */}
        {wsStatus === "error" && (
          <View className="bg-red-50 px-4 py-2 flex-row items-center gap-2">
            <Ionicons name="wifi-outline" size={14} color="#dc2626" />
            <Text className="text-red-600 text-xs">Sem conexão em tempo real — usando modo offline</Text>
          </View>
        )}

        {/* Messages */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1d4ed8" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <MessageBubble msg={item} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center pt-16">
                <Ionicons name="chatbubbles-outline" size={40} color="#d1d5db" />
                <Text className="text-gray-400 mt-3">Nenhuma mensagem ainda</Text>
                <Text className="text-gray-400 text-sm">Diga olá!</Text>
              </View>
            }
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        {/* Input bar */}
        <View className="flex-row items-end gap-2 px-4 py-3 bg-white border-t border-gray-100">
          <TextInput
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-gray-800 text-sm max-h-28"
            placeholder="Digite uma mensagem..."
            multiline
            value={input}
            onChangeText={setInput}
            returnKeyType="default"
          />
          <TouchableOpacity
            className={`w-11 h-11 rounded-full items-center justify-center ${
              input.trim() && !sending ? "bg-blue-700" : "bg-gray-200"
            }`}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#6b7280" />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={input.trim() ? "white" : "#9ca3af"}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
