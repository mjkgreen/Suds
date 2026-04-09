import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";

interface NavItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Feed", icon: "beer-outline", activeIcon: "beer", href: "/(tabs)/feed" },
  { label: "Map", icon: "map-outline", activeIcon: "map", href: "/(tabs)/map" },
  { label: "Search", icon: "search-outline", activeIcon: "search", href: "/(tabs)/search" },
  { label: "Profile", icon: "person-outline", activeIcon: "person", href: "/(tabs)/profile" },
];

function UserDropdown({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const router = useRouter();
  const { signOut } = useAuthStore();

  const handleSignOut = async () => {
    onClose();
    await supabase.auth.signOut();
    signOut();
    router.replace("/");
  };

  return (
    <View
      className={`absolute right-0 top-12 rounded-xl shadow-lg border z-50 overflow-hidden ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}
      style={{ width: 180 }}
    >
      <Pressable
        onPress={() => {
          onClose();
          router.push("/(tabs)/profile" as never);
        }}
        className={`px-4 py-3 ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-50"}`}
      >
        <Text className={`text-sm ${isDark ? "text-gray-200" : "text-gray-700"}`}>Profile</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          onClose();
          router.push("/user/settings" as never);
        }}
        className={`px-4 py-3 ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-50"}`}
      >
        <Text className={`text-sm ${isDark ? "text-gray-200" : "text-gray-700"}`}>Settings</Text>
      </Pressable>
      <View className={`h-px ${isDark ? "bg-gray-700" : "bg-gray-100"}`} />
      <Pressable onPress={handleSignOut} className={`px-4 py-3 ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-50"}`}>
        <Text className="text-sm text-red-500">Sign Out</Text>
      </Pressable>
    </View>
  );
}

export function WebNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { profile } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isActive = (href: string) => {
    const segment = href.replace("/(tabs)/", "");
    return pathname.includes(segment);
  };

  return (
    <View
      className={`w-full border-b ${isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}
      style={{ paddingHorizontal: 24, paddingVertical: 0 }}
    >
      <View
        style={{
          maxWidth: 1100,
          width: "100%",
          alignSelf: "center",
          flexDirection: "row",
          alignItems: "center",
          height: 60,
          gap: 8,
        }}
      >
        {/* Logo */}
        <Pressable
          onPress={() => router.push("/(tabs)/feed" as never)}
          style={{ marginRight: 24, flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Image
            source={require("../../../assets/icon.png")}
            style={{ width: 32, height: 32, borderRadius: 4 }}
            contentFit="cover"
          />
          <Text className="text-lg font-bold text-primary" style={{ letterSpacing: -0.5 }}>
            Suds
          </Text>
        </Pressable>

        {/* Nav links */}
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Pressable
                key={item.label}
                onPress={() => router.push(item.href as never)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
                className={
                  active ? (isDark ? "bg-gray-800" : "bg-amber-50") : isDark ? "hover:bg-gray-800" : "hover:bg-gray-50"
                }
              >
                <Ionicons
                  name={active ? item.activeIcon : item.icon}
                  size={18}
                  color={active ? "#f59e0b" : isDark ? "#6b7280" : "#9ca3af"}
                />
                <Text
                  className={`text-sm font-medium ${active ? "text-primary" : isDark ? "text-gray-400" : "text-gray-500"}`}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Right: Log drink + avatar */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => router.push("/(tabs)/log" as never)}
            className="bg-primary rounded-full items-center justify-center"
            style={{ width: 36, height: 36 }}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>

          {/* Avatar with dropdown */}
          <View style={{ position: "relative" }}>
            <Pressable
              onPress={() => setDropdownOpen((v) => !v)}
              className={`rounded-full items-center justify-center overflow-hidden border-2 ${dropdownOpen ? "border-primary" : isDark ? "border-gray-700" : "border-gray-200"}`}
              style={{ width: 36, height: 36 }}
            >
              {profile?.avatar_url ? (
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                <View className="w-full h-full bg-gray-300 items-center justify-center">
                  <Text className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-700"}`}>
                    {(profile.display_name ?? profile.username ?? "?")[0].toUpperCase()}
                  </Text>
                </View>
              ) : (
                <View className={`w-full h-full items-center justify-center ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
                  <Text className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-700"}`}>
                    {(profile?.display_name ?? profile?.username ?? "?")[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </Pressable>

            {dropdownOpen && <UserDropdown isDark={isDark} onClose={() => setDropdownOpen(false)} />}
          </View>
        </View>
      </View>

      {/* Overlay to close dropdown */}
      {dropdownOpen && (
        <Pressable
          onPress={() => setDropdownOpen(false)}
          style={{
            position: "fixed" as never,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
          }}
        />
      )}
    </View>
  );
}
