import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  Switch,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeStore } from "@/stores/themeStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { useColorScheme } from "nativewind";

export default function SettingsScreen() {
  const router = useRouter();
  const { themePreference, setThemePreference } = useThemeStore();
  const { locationEnabled, setLocationEnabled, hideAddresses, setHideAddresses } = usePrefsStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const themeOptions: { label: string; value: "light" | "dark" | "system"; icon: string }[] = [
    { label: "Light", value: "light", icon: "sunny" },
    { label: "Dark", value: "dark", icon: "moon" },
    { label: "System", value: "system", icon: "contrast" },
  ];

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
      <View className="flex-row items-center px-4 py-3 bg-background border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 mr-2">
          <Ionicons name="arrow-back" size={22} color="#f59e0b" />
        </Pressable>
        <Text className="font-bold text-foreground text-base flex-1">Settings</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        {/* Appearance Section */}
        <Text className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-4 ml-1">
          Appearance
        </Text>
        <View className="bg-card rounded-2xl overflow-hidden border border-border mb-8">
          {themeOptions.map((option, index) => (
            <Pressable
              key={option.value}
              onPress={() => setThemePreference(option.value)}
              className={`flex-row items-center justify-between px-4 py-4 ${
                index !== themeOptions.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 rounded-lg bg-accent items-center justify-center">
                  <Ionicons name={option.icon as any} size={18} color="#f59e0b" />
                </View>
                <Text className="text-foreground font-medium">{option.label}</Text>
              </View>
              {themePreference === option.value && (
                <Ionicons name="checkmark-circle" size={22} color="#f59e0b" />
              )}
            </Pressable>
          ))}
        </View>

        {/* Preferences Section */}
        <Text className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-4 ml-1">
          Preferences
        </Text>
        <View className="bg-card rounded-2xl overflow-hidden border border-border mb-8">
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
            <View className="flex-row items-center gap-3 flex-1">
              <View className="w-8 h-8 rounded-lg bg-accent items-center justify-center">
                <Ionicons name="location" size={18} color="#f59e0b" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-medium">Location Services</Text>
                <Text className="text-muted-foreground text-xs">
                  Tag your drinks with your location
                </Text>
              </View>
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={setLocationEnabled}
              trackColor={{ false: "#767577", true: "#f59e0b" }}
              thumbColor={Platform.OS === "ios" ? "#fff" : locationEnabled ? "#fff" : "#f4f3f4"}
            />
          </View>
          <View className="flex-row items-center justify-between px-4 py-4">
            <View className="flex-row items-center gap-3 flex-1">
              <View className="w-8 h-8 rounded-lg bg-accent items-center justify-center">
                <Ionicons name="shield-checkmark" size={18} color="#f59e0b" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-medium">Privacy Mode</Text>
                <Text className="text-muted-foreground text-xs">
                  Auto-hide specific street addresses
                </Text>
              </View>
            </View>
            <Switch
              value={hideAddresses}
              onValueChange={setHideAddresses}
              trackColor={{ false: "#767577", true: "#f59e0b" }}
              thumbColor={Platform.OS === "ios" ? "#fff" : hideAddresses ? "#fff" : "#f4f3f4"}
            />
          </View>
        </View>

        <Text className="text-muted-foreground text-center text-xs mt-4">
          More settings coming soon!
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
