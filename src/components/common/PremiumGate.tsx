import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useAuthStore } from "@/stores/authStore";

interface PremiumGateProps {
  children: React.ReactNode;
  /** Optional preview shown to free users instead of dimming the real content */
  preview?: React.ReactNode;
  /** Short label shown on the locked overlay, e.g. "Advanced Stats" */
  featureName: string;
}

/**
 * Wraps premium-only content.
 * - Premium users: see real children.
 * - Free users: see `preview` (or dimmed children) with a lock overlay.
 */
export function PremiumGate({ children, preview, featureName }: PremiumGateProps) {
  const { isPremium } = useAuthStore();
  const router = useRouter();

  if (isPremium) return <>{children}</>;

  return (
    <View style={{ position: "relative" }} className="bg-card">
      {/* Preview content (non-interactive) */}
      <View pointerEvents="none" aria-hidden style={preview ? undefined : { opacity: 0.15 }}>
        {preview ?? children}
      </View>

      {/* Lock overlay */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          gap: 6,
        }}
        className="bg-background/70 "
      >
        <View className="bg-card border border-muted rounded-2xl p-4 items-center">
          <View className="bg-card border border-muted rounded-full p-3 mb-1">
            <Ionicons name="lock-closed" size={22} color="#d97706" />
          </View>
          <Text className="text-foreground font-bold text-base text-center">{featureName}</Text>
          <Text className="text-muted-foreground text-xs text-center">Unlock with Suds Plus</Text>
          <Pressable className="bg-primary rounded-xl px-6 py-2.5 mt-2" onPress={() => router.push("/paywall")}>
            <Text className="text-primary-foreground font-bold text-sm">Upgrade</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
