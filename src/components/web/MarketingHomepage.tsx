import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { useColorScheme } from "nativewind";
import { PublicLayout } from "./PublicLayout";
import { useAuth } from "@/hooks/useAuth";

// ─── Sub-components ──────────────────────────────────────────────────────────

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View className={`flex-1 h-px ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
      <Text className={`text-xs font-medium ${isDark ? "text-gray-600" : "text-gray-400"}`}>or</Text>
      <View className={`flex-1 h-px ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
    </View>
  );
}

function SignUpButtons({
  isDark,
  googleLoading,
  appleLoading,
  onEmail,
  onGoogle,
  onApple,
  onSignIn,
}: {
  isDark: boolean;
  googleLoading: boolean;
  appleLoading: boolean;
  onEmail: () => void;
  onGoogle: () => void;
  onApple: () => void;
  onSignIn: () => void;
}) {
  const anyLoading = googleLoading || appleLoading;
  return (
    <View style={{ width: "100%", maxWidth: 360, gap: 12 }}>
      <Pressable
        onPress={onEmail}
        className="bg-primary rounded-xl items-center justify-center"
        style={{ paddingVertical: 14 }}
      >
        <Text className="text-white font-semibold text-base">Sign up with email</Text>
      </Pressable>

      <Divider isDark={isDark} />

      <Pressable
        onPress={onGoogle}
        disabled={anyLoading}
        className="rounded-xl items-center justify-center border bg-white border-gray-200"
        style={{ paddingVertical: 13, flexDirection: "row", gap: 10, opacity: googleLoading ? 0.6 : 1 }}
      >
        <Image
          source={require("../../../assets/google-logo.svg")}
          style={{ width: 20, height: 20 }}
          contentFit="contain"
        />
        <Text className="text-gray-800 font-semibold text-base">
          {googleLoading ? "Redirecting…" : "Sign up with Google"}
        </Text>
      </Pressable>

      <Pressable
        onPress={onApple}
        disabled={anyLoading}
        style={{
          paddingVertical: 13,
          flexDirection: "row",
          gap: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000",
          borderRadius: 12,
          opacity: appleLoading ? 0.6 : 1,
        }}
      >
        <Ionicons name="logo-apple" size={20} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
          {appleLoading ? "Redirecting…" : "Sign up with Apple"}
        </Text>
      </Pressable>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 4 }}>
        <Text className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>Already have an account?</Text>
        <Pressable onPress={onSignIn}>
          <Text className="text-primary text-sm font-semibold">Sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Realistic iPhone 15 Pro frame
function IPhoneFrame({ source, isDark }: { source: number; isDark: boolean }) {
  const frameW = 260;
  const frameH = 540;
  const screenW = 240;
  const screenH = 520;

  return (
    <View
      style={{
        width: frameW,
        height: frameH,
        borderRadius: 46,
        backgroundColor: isDark ? "#1c1c1e" : "#2c2c2e",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 28 },
        shadowOpacity: isDark ? 0.6 : 0.18,
        shadowRadius: 48,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* Side buttons — left */}
      {/* Silent switch */}
      <View
        style={{
          position: "absolute",
          left: -3,
          top: 108,
          width: 4,
          height: 28,
          borderRadius: 2,
          backgroundColor: isDark ? "#3a3a3c" : "#48484a",
        }}
      />
      {/* Volume up */}
      <View
        style={{
          position: "absolute",
          left: -3,
          top: 152,
          width: 4,
          height: 52,
          borderRadius: 2,
          backgroundColor: isDark ? "#3a3a3c" : "#48484a",
        }}
      />
      {/* Volume down */}
      <View
        style={{
          position: "absolute",
          left: -3,
          top: 216,
          width: 4,
          height: 52,
          borderRadius: 2,
          backgroundColor: isDark ? "#3a3a3c" : "#48484a",
        }}
      />
      {/* Power button — right */}
      <View
        style={{
          position: "absolute",
          right: -3,
          top: 168,
          width: 4,
          height: 72,
          borderRadius: 2,
          backgroundColor: isDark ? "#3a3a3c" : "#48484a",
        }}
      />

      {/* Screen bezel */}
      <View
        style={{
          width: screenW,
          height: screenH,
          borderRadius: 38,
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        <Image source={source} style={{ width: screenW, height: screenH }} contentFit="cover" contentPosition="top" />

        {/* Home indicator */}
        <View
          style={{
            position: "absolute",
            bottom: 8,
            alignSelf: "center",
            width: 120,
            height: 5,
            borderRadius: 3,
            backgroundColor: "rgba(255,255,255,0.35)",
          }}
        />
      </View>
    </View>
  );
}

// Feature data type
interface FeatureTab {
  label: string;
  title: string;
  description: string;
  bullets: string[];
  icon: keyof typeof Ionicons.glyphMap;
  imageSource: number;
}

// Tabbed feature showcase — image always left, text always right
function FeatureShowcase({ isDark, isWide }: { isDark: boolean; isWide: boolean }) {
  const [activeTab, setActiveTab] = useState(0);

  const tabs: FeatureTab[] = [
    {
      label: "Social Feed",
      icon: "people-outline",
      title: "Your social feed, for drinks",
      description:
        "See what your friends are drinking in real time. Like, comment, and share your own sessions to build your drinking history together.",
      bullets: [
        "Follow friends and discover new people nearby",
        "See drink type, brand, location, and notes",
        "Reactions and social engagement built in",
      ],
      imageSource: require("../../../assets/feed.png"),
    },
    {
      label: "Log Drinks",
      icon: "beer-outline",
      title: "Log drinks in seconds",
      description:
        "Quick-log any drink with beer, wine, cocktail presets — or search from thousands of brands. Add a location, rating, and notes while your memory is fresh.",
      bullets: [
        "Auto-complete for 1000s of drinks and brands",
        "Set ABV, quantity, and session grouping",
        "GPS location tagging with privacy controls",
      ],
      imageSource: require("../../../assets/log-drinks.png"),
    },
    {
      label: "Live BAC",
      icon: "speedometer-outline",
      title: "Know your stats in real time",
      description: "See your drinking habits and trends over time. Always know where you stand — and when to stop.",
      bullets: [
        "Drinks-per-hour tracking with session history",
        "Personalized to your body metrics",
        "Live BAC updated drink-by-drink (coming soon!)",
      ],
      imageSource: require("../../../assets/view-stats.png"),
    },
    {
      label: "Map",
      icon: "map-outline",
      title: "See the scene on the map",
      description:
        "A live heatmap shows drink activity from you and your network. Discover where people are going out — with full privacy controls so you share only what you want.",
      bullets: [
        "Live heatmap updated as friends log drinks",
        "Privacy Mode hides your exact address",
        "Filter by time, drink type, or friends",
      ],
      imageSource: require("../../../assets/map.png"),
    },
  ];

  const active = tabs[activeTab];

  const prev = () => setActiveTab((i) => (i - 1 + tabs.length) % tabs.length);
  const next = () => setActiveTab((i) => (i + 1) % tabs.length);

  return (
    <View style={{ gap: 0 }}>
      {/* Content — image left, text right (stack on narrow) */}
      {isWide ? (
        <View style={{ flexDirection: "row", gap: 72, alignItems: "center" }}>
          {/* Phone + arrows */}
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
              <Pressable
                onPress={prev}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: isDark ? "#374151" : "#e5e7eb",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                }}
              >
                <Ionicons name="chevron-back" size={20} color={isDark ? "#9ca3af" : "#6b7280"} />
              </Pressable>
              <IPhoneFrame source={active.imageSource} isDark={isDark} />
              <Pressable
                onPress={next}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: isDark ? "#374151" : "#e5e7eb",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                }}
              >
                <Ionicons name="chevron-forward" size={20} color={isDark ? "#9ca3af" : "#6b7280"} />
              </Pressable>
            </View>
            {/* Dot indicators */}
            <View style={{ flexDirection: "row", gap: 6, marginTop: 24 }}>
              {tabs.map((_, i) => (
                <Pressable key={i} onPress={() => setActiveTab(i)}>
                  <View
                    style={{
                      width: i === activeTab ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: i === activeTab ? "#f59e0b" : isDark ? "#374151" : "#d1d5db",
                    }}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          {/* Text */}
          <View style={{ flex: 1.3, justifyContent: "center", gap: 24 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: isDark ? "#1f2937" : "#fef3c7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={active.icon} size={24} color="#f59e0b" />
            </View>
            <View style={{ gap: 10 }}>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "800",
                  letterSpacing: -0.5,
                  color: isDark ? "#fff" : "#111827",
                }}
              >
                {active.title}
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  lineHeight: 28,
                  color: isDark ? "#9ca3af" : "#6b7280",
                }}
              >
                {active.description}
              </Text>
            </View>
            <View style={{ gap: 12 }}>
              {active.bullets.map((b) => (
                <View key={b} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: "#f59e0b",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 2,
                      flexShrink: 0,
                    }}
                  >
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  </View>
                  <Text style={{ fontSize: 15, lineHeight: 24, flex: 1, color: isDark ? "#d1d5db" : "#374151" }}>
                    {b}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View style={{ gap: 40, alignItems: "center" }}>
          {/* Text above on narrow */}
          <View style={{ gap: 16, width: "100%" }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: isDark ? "#1f2937" : "#fef3c7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={active.icon} size={22} color="#f59e0b" />
            </View>
            <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: isDark ? "#fff" : "#111827" }}>
              {active.title}
            </Text>
            <Text style={{ fontSize: 15, lineHeight: 26, color: isDark ? "#9ca3af" : "#6b7280" }}>
              {active.description}
            </Text>
            <View style={{ gap: 10 }}>
              {active.bullets.map((b) => (
                <View key={b} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: "#f59e0b",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 2,
                      flexShrink: 0,
                    }}
                  >
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                  <Text style={{ fontSize: 14, lineHeight: 22, flex: 1, color: isDark ? "#d1d5db" : "#374151" }}>
                    {b}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          {/* Phone + arrows (narrow) */}
          <View style={{ alignItems: "center", gap: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <Pressable
                onPress={prev}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 1.5,
                  borderColor: isDark ? "#374151" : "#e5e7eb",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                }}
              >
                <Ionicons name="chevron-back" size={18} color={isDark ? "#9ca3af" : "#6b7280"} />
              </Pressable>
              <IPhoneFrame source={active.imageSource} isDark={isDark} />
              <Pressable
                onPress={next}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 1.5,
                  borderColor: isDark ? "#374151" : "#e5e7eb",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                }}
              >
                <Ionicons name="chevron-forward" size={18} color={isDark ? "#9ca3af" : "#6b7280"} />
              </Pressable>
            </View>
            {/* Dot indicators */}
            <View style={{ flexDirection: "row", gap: 6 }}>
              {tabs.map((_, i) => (
                <Pressable key={i} onPress={() => setActiveTab(i)}>
                  <View
                    style={{
                      width: i === activeTab ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: i === activeTab ? "#f59e0b" : isDark ? "#374151" : "#d1d5db",
                    }}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketingHomepage() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  async function handleGoogleSignUp() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      // errors handled by Supabase redirect
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleAppleSignUp() {
    setAppleLoading(true);
    try {
      await signInWithApple();
    } catch {
      // errors handled by Supabase redirect
    } finally {
      setAppleLoading(false);
    }
  }

  return (
    <PublicLayout>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {isWide ? (
        <View
          className={`w-full overflow-hidden ${isDark ? "bg-gray-950" : "bg-white"}`}
          style={{ flexDirection: "row", minHeight: 620 }}
        >
          <View style={{ flex: 1, overflow: "hidden" }}>
            <Image
              source={require("../../../assets/hero1.jpg")}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              contentPosition="center"
            />
          </View>

          <View
            style={{
              flex: 1.4,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 56,
              paddingVertical: 80,
            }}
          >
            <Text
              className={`font-bold text-center mb-4 ${isDark ? "text-white" : "text-gray-900"}`}
              style={{ fontSize: 48, lineHeight: 56, letterSpacing: -1.5 }}
            >
              Track your drinks.{"\n"}Know your limits.
            </Text>

            <Text
              className={`text-base text-center mb-10 ${isDark ? "text-gray-400" : "text-gray-500"}`}
              style={{ lineHeight: 26, maxWidth: 360 }}
            >
              The social drink tracker that helps you log what you drink, and share the night with friends.
            </Text>

            <SignUpButtons
              isDark={isDark}
              googleLoading={googleLoading}
              appleLoading={appleLoading}
              onEmail={() => router.push("/(auth)/sign-up" as never)}
              onGoogle={handleGoogleSignUp}
              onApple={handleAppleSignUp}
              onSignIn={() => router.push("/(auth)/sign-in" as never)}
            />
          </View>

          <View style={{ flex: 1, overflow: "hidden" }}>
            <Image
              source={require("../../../assets/hero2.jpg")}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              contentPosition="center"
            />
          </View>
        </View>
      ) : (
        <View
          className={`w-full ${isDark ? "bg-gray-950" : "bg-white"}`}
          style={{ paddingVertical: 56, paddingHorizontal: 24, alignItems: "center" }}
        >
          <Text
            className={`font-bold text-center mb-4 ${isDark ? "text-white" : "text-gray-900"}`}
            style={{ fontSize: 36, lineHeight: 44, letterSpacing: -1.5 }}
          >
            Track your drinks.{"\n"}Know your limits.
          </Text>
          <Text
            className={`text-base text-center mb-10 ${isDark ? "text-gray-400" : "text-gray-500"}`}
            style={{ lineHeight: 26, maxWidth: 360 }}
          >
            The social drink tracker that helps you log what you drink, and share the night with friends.
          </Text>
          <SignUpButtons
            isDark={isDark}
            googleLoading={googleLoading}
            appleLoading={appleLoading}
            onEmail={() => router.push("/(auth)/sign-up" as never)}
            onGoogle={handleGoogleSignUp}
            onApple={handleAppleSignUp}
            onSignIn={() => router.push("/(auth)/sign-in" as never)}
          />
        </View>
      )}

      {/* ── Feature showcase (tabbed) ────────────────────────────────────── */}
      <View
        className={`w-full ${isDark ? "bg-gray-950" : "bg-gray-50"}`}
        style={{ paddingVertical: 64, paddingHorizontal: isWide ? 64 : 24 }}
      >
        <View style={{ maxWidth: 1100, width: "100%", alignSelf: "center" }}>
          <FeatureShowcase isDark={isDark} isWide={isWide} />
        </View>
      </View>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <View
        style={{
          backgroundColor: isDark ? "#0f172a" : "#111827",
          paddingVertical: 96,
          paddingHorizontal: 32,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: isWide ? 40 : 30,
            fontWeight: "800",
            color: "#fff",
            textAlign: "center",
            letterSpacing: -1,
            marginBottom: 16,
          }}
        >
          Start tracking smarter.
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: "#9ca3af",
            textAlign: "center",
            marginBottom: 40,
            maxWidth: 400,
            lineHeight: 26,
          }}
        >
          Free to download. Know your limits. Drink with your crew.
        </Text>

        <View style={{ flexDirection: isWide ? "row" : "column", gap: 12, alignItems: "center" }}>
          {/* App Store — proper Apple logo via Ionicons */}
          <Pressable
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: "#fff",
              borderRadius: 14,
              paddingHorizontal: 20,
              paddingVertical: 12,
            }}
          >
            <Ionicons name="logo-apple" size={24} color="#111827" />
            <View>
              <Text style={{ fontSize: 11, color: "#6b7280", fontWeight: "500" }}>Download on the</Text>
              <Text style={{ fontSize: 16, color: "#111827", fontWeight: "700" }}>App Store</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/sign-up" as never)}
            style={{
              borderRadius: 14,
              paddingHorizontal: 24,
              paddingVertical: 14,
              backgroundColor: "#f59e0b",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Create free account</Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 12, color: "#4b5563", marginTop: 32, textAlign: "center" }}>
          By signing up you agree to our{" "}
          <Text
            style={{ color: "#6b7280", textDecorationLine: "underline" }}
            onPress={() => router.push("/terms" as never)}
          >
            Terms
          </Text>{" "}
          and{" "}
          <Text
            style={{ color: "#6b7280", textDecorationLine: "underline" }}
            onPress={() => router.push("/privacy" as never)}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
    </PublicLayout>
  );
}
