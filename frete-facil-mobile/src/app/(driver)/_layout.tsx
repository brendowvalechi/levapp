import { Stack } from "expo-router";

export default function DriverLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#1d4ed8",
        headerTitleStyle: { fontWeight: "600", color: "#111827" },
        headerBackTitle: "Voltar",
      }}
    >
      <Stack.Screen name="verification" options={{ title: "Verificação" }} />
      <Stack.Screen name="upload-cnh" options={{ title: "Enviar CNH" }} />
      <Stack.Screen name="upload-selfie" options={{ title: "Enviar Selfie" }} />
      <Stack.Screen name="add-vehicle" options={{ title: "Cadastrar Veículo" }} />
      <Stack.Screen name="upload-crlv" options={{ title: "Enviar CRLV" }} />
    </Stack>
  );
}
