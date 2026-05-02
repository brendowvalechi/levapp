import { Stack } from "expo-router";

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#1d4ed8",
        headerTitleStyle: { fontWeight: "600", color: "#111827" },
        headerBackTitle: "Voltar",
      }}
    >
      <Stack.Screen name="[rideId]" options={{ title: "Chat" }} />
    </Stack>
  );
}
