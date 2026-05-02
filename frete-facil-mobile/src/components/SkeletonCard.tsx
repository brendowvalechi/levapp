import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

function SkeletonBox({ className }: { className: string }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity }}
      className={`bg-gray-200 rounded-lg ${className}`}
    />
  );
}

export function RideCardSkeleton() {
  return (
    <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
      <View className="flex-row justify-between mb-3">
        <View className="gap-1.5">
          <SkeletonBox className="w-20 h-3" />
          <SkeletonBox className="w-14 h-3" />
        </View>
        <SkeletonBox className="w-24 h-6 rounded-lg" />
      </View>
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <SkeletonBox className="w-2.5 h-2.5 rounded-full" />
          <SkeletonBox className="flex-1 h-3" />
        </View>
        <SkeletonBox className="ml-1.5 w-px h-3" />
        <View className="flex-row items-center gap-2">
          <SkeletonBox className="w-2.5 h-2.5 rounded-full" />
          <SkeletonBox className="flex-1 h-3" />
        </View>
      </View>
    </View>
  );
}
