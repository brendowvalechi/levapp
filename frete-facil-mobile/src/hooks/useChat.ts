import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chatService, MessageResponse } from "@/services/chatService";
import { useAuthStore } from "@/store/auth";
import { api } from "@/services/api";

export function useConversations() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["conversations"],
    queryFn: chatService.listConversations,
    enabled: !!token,
    refetchInterval: 10000,
  });
}

export function useMessages(rideId: string) {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["messages", rideId],
    queryFn: () => chatService.getMessages(rideId),
    enabled: !!token && !!rideId,
    staleTime: 0,
  });
}

// ─── WebSocket chat hook ──────────────────────────────────────────────────────

export type WsStatus = "connecting" | "open" | "closed" | "error";

export function useChatSocket(rideId: string) {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WsStatus>("closed");

  const addMessage = useCallback(
    (msg: MessageResponse) => {
      queryClient.setQueryData<MessageResponse[]>(
        ["messages", rideId],
        (prev) => {
          if (!prev) return [msg];
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        }
      );
      // Refresh conversations badge
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    [queryClient, rideId]
  );

  useEffect(() => {
    if (!token || !rideId) return;

    const baseUrl = (api.defaults.baseURL ?? "http://localhost:8000")
      .replace("https://", "wss://")
      .replace("http://", "ws://");

    const url = `${baseUrl}/api/v1/ws/chat/${rideId}?token=${token}`;
    setStatus("connecting");

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus("open");
    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("closed");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
          addMessage(data as MessageResponse);
        }
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token, rideId, addMessage]);

  const sendMessage = useCallback(
    (content: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "message", content }));
        return true;
      }
      return false;
    },
    []
  );

  const sendReadAck = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "read" }));
  }, []);

  return { status, sendMessage, sendReadAck };
}
