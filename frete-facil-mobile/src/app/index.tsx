import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@/store/auth";
import { ONBOARDING_KEY } from "./onboarding";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { token } = useAuthStore();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(ONBOARDING_KEY).then((val) => {
      setOnboardingDone(val === "1");
    });
  }, []);

  if (onboardingDone === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#1d4ed8" />
      </View>
    );
  }

  if (!onboardingDone) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href={token ? "/(tabs)" : "/(auth)/welcome"} />;
}
