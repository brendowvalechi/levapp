import { api } from "./api";

export interface MessageResponse {
  id: string;
  ride_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ConversationResponse {
  ride_id: string;
  other_user_id: string;
  other_user_name: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export const chatService = {
  listConversations: () =>
    api.get<ConversationResponse[]>("/api/v1/conversations").then((r) => r.data),

  getMessages: (rideId: string, limit = 50) =>
    api
      .get<MessageResponse[]>(`/api/v1/rides/${rideId}/messages`, { params: { limit } })
      .then((r) => r.data),

  sendMessage: (rideId: string, content: string) =>
    api
      .post<MessageResponse>(`/api/v1/rides/${rideId}/messages`, { content })
      .then((r) => r.data),

  markRead: (rideId: string) =>
    api.post(`/api/v1/rides/${rideId}/messages/read`).then((r) => r.data),
};
