import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "cube-outline" as const,
    color: "#1d4ed8",
    bg: "#eff6ff",
    title: "Levagens simples e rápidas",
    desc: "Publique sua levagem em segundos e receba propostas de motoristas verificados na sua região.",
  },
  {
    icon: "shield-checkmark-outline" as const,
    color: "#16a34a",
    bg: "#f0fdf4",
    title: "Motoristas verificados",
    desc: "Todos os transportadores passam por verificação de CNH e documentos antes de atender levagens.",
  },
  {
    icon: "location-outline" as const,
    color: "#7c3aed",
    bg: "#f5f3ff",
    title: "Rastreio em tempo real",
    desc: "Acompanhe sua carga no mapa durante todo o trajeto com atualização ao vivo.",
  },
  {
    icon: "card-outline" as const,
    color: "#d97706",
    bg: "#fffbeb",
    title: "Pagamento seguro",
    desc: "Pague via Pix ou cartão com proteção total. O valor só é liberado após a entrega.",
  },
];

export const ONBOARDING_KEY = "onboarding_done_v1";

export default function OnboardingScreen() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) setActiveIndex(viewableItems[0].index ?? 0);
    }
  ).current;

  async function finish() {
    await SecureStore.setItemAsync(ONBOARDING_KEY, "1");
    router.replace("/(auth)/welcome");
  }

  function next() {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  }

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Skip */}
      <View className="flex-row justify-end px-6 pt-4">
        <TouchableOpacity onPress={finish}>
          <Text className="text-gray-400 font-medium">Pular</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1 items-center justify-center px-8 pb-4">
            <View
              style={{ backgroundColor: item.bg }}
              className="w-32 h-32 rounded-3xl items-center justify-center mb-8"
            >
              <Ionicons name={item.icon} size={64} color={item.color} />
            </View>
            <Text className="text-gray-900 font-bold text-2xl text-center mb-4">
              {item.title}
            </Text>
            <Text className="text-gray-500 text-base text-center leading-relaxed">
              {item.desc}
            </Text>
          </View>
        )}
      />

      {/* Dots + CTA */}
      <View className="px-6 pb-8 gap-6">
        {/* Dots */}
        <View className="flex-row justify-center gap-2">
          {SLIDES.map((_, i) => (
            <View
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === activeIndex ? "bg-blue-700 w-6" : "bg-gray-200 w-2"
              }`}
            />
          ))}
        </View>

        {/* Button */}
        <TouchableOpacity
          className="bg-blue-700 rounded-2xl py-4 items-center"
          onPress={next}
          activeOpacity={0.85}
        >
          <Text className="text-white font-bold text-base">
            {isLast ? "Começar" : "Próximo"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
