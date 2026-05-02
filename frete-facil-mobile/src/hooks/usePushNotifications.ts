import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/auth";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Levapp",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1d4ed8",
    });
  }

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

async function saveTokenToApi(token: string): Promise<void> {
  try {
    await api.patch("/api/v1/users/me", { fcm_token: token });
  } catch {
    // Non-critical — ignore silently
  }
}

export function usePushNotifications() {
  const { token: authToken } = useAuthStore();
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!authToken) return;

    // Register and save token
    registerForPushNotifications().then((pushToken) => {
      if (pushToken) saveTokenToApi(pushToken);
    });

    // Listen for foreground notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // Notification received in foreground — expo-notifications will show it
      }
    );

    // Handle tap on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, string>;
        if (!data?.type) return;

        switch (data.type) {
          case "new_offer":
          case "offer_accepted":
          case "ride_started":
          case "ride_completed":
            if (data.ride_id) {
              router.push({ pathname: "/ride/[id]", params: { id: data.ride_id } });
            }
            break;
          case "new_message":
            if (data.ride_id) {
              router.push({ pathname: "/chat/[rideId]", params: { rideId: data.ride_id } });
            }
            break;
          case "payment_approved":
            if (data.ride_id) {
              router.push({ pathname: "/ride/[id]", params: { id: data.ride_id } });
            }
            break;
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [authToken, router]);
}
