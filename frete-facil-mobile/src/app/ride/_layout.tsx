import { Stack } from "expo-router";

export default function RideLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#1d4ed8",
        headerTitleStyle: { fontWeight: "600", color: "#111827" },
        headerBackTitle: "Voltar",
      }}
    >
      <Stack.Screen name="[id]" options={{ title: "Detalhes do Frete" }} />
      <Stack.Screen name="make-offer" options={{ title: "Enviar Proposta" }} />
      <Stack.Screen name="track" options={{ title: "Rastrear", headerShown: false }} />
      <Stack.Screen name="payment" options={{ title: "Pagamento" }} />
      <Stack.Screen name="review" options={{ title: "Avaliar corrida" }} />
    </Stack>
  );
}
