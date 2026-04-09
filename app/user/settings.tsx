import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeStore } from "@/stores/themeStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { useColorScheme } from "nativewind";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsScreen() {
  const router = useRouter();
  const { themePreference, setThemePreference } = useThemeStore();
  const { locationEnabled, setLocationEnabled, hideAddresses, setHideAddresses } = usePrefsStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { changePassword, deleteAccount, user } = useAuth();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isOAuthUser = !user?.email || (user?.app_metadata?.provider !== "email" && !user?.app_metadata?.providers?.includes("email"));

  const themeOptions: { label: string; value: "light" | "dark" | "system"; icon: string }[] = [
    { label: "Light", value: "light", icon: "sunny" },
    { label: "Dark", value: "dark", icon: "moon" },
    { label: "System", value: "system", icon: "contrast" },
  ];

  async function handleChangePassword() {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setPasswordLoading(true);
    try {
      await changePassword(newPassword);
      setShowChangePassword(false);
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Success", "Your password has been updated.");
    } catch (err: any) {
      setPasswordError(err.message ?? "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  }

  function handleCancelChangePassword() {
    setShowChangePassword(false);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") return;
    setDeleteLoading(true);
    try {
      await deleteAccount();
    } catch (err: any) {
      setDeleteLoading(false);
      Alert.alert("Error", err.message ?? "Failed to delete account.");
    }
  }

  function handleCancelDeleteAccount() {
    setShowDeleteAccount(false);
    setDeleteConfirmText("");
  }

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

        {/* Account Section */}
        <Text className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-4 ml-1">
          Account
        </Text>
        <View className="bg-card rounded-2xl overflow-hidden border border-border mb-8">
          <Pressable
            onPress={() => {
              if (isOAuthUser) {
                Alert.alert("Not available", "Password changes are not available for accounts signed in with Apple or Google.");
                return;
              }
              setShowChangePassword(true);
            }}
            className="flex-row items-center justify-between px-4 py-4 border-b border-border"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-lg bg-accent items-center justify-center">
                <Ionicons name="lock-closed" size={18} color="#f59e0b" />
              </View>
              <Text className="text-foreground font-medium">Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </Pressable>
          <Pressable
            onPress={() => setShowDeleteAccount(true)}
            className="flex-row items-center justify-between px-4 py-4"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-lg bg-red-100 items-center justify-center">
                <Ionicons name="trash" size={18} color="#ef4444" />
              </View>
              <Text className="text-red-500 font-medium">Delete Account</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </Pressable>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePassword}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancelChangePassword}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className={`flex-1 bg-background ${isDark ? "dark" : ""}`}
        >
          <SafeAreaView className="flex-1 bg-background">
            <View className="flex-row items-center px-4 py-3 border-b border-border">
              <Pressable onPress={handleCancelChangePassword} className="p-2 mr-2">
                <Ionicons name="close" size={22} color="#9ca3af" />
              </Pressable>
              <Text className="font-bold text-foreground text-base flex-1">Change Password</Text>
              <Pressable
                onPress={handleChangePassword}
                disabled={passwordLoading}
                className="px-4 py-1.5 bg-amber-500 rounded-lg"
              >
                <Text className="text-white font-semibold text-sm">
                  {passwordLoading ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-6" keyboardShouldPersistTaps="handled">
              <View className="gap-4">
                <View>
                  <Text className="text-foreground font-medium mb-1.5 text-sm">New Password</Text>
                  <TextInput
                    className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
                    placeholder="At least 8 characters"
                    placeholderTextColor="#9ca3af"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoComplete="new-password"
                  />
                </View>
                <View>
                  <Text className="text-foreground font-medium mb-1.5 text-sm">Confirm New Password</Text>
                  <TextInput
                    className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
                    placeholder="Re-enter new password"
                    placeholderTextColor="#9ca3af"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoComplete="new-password"
                  />
                </View>
                {passwordError && (
                  <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <Text className="text-red-600 text-sm">{passwordError}</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteAccount}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancelDeleteAccount}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className={`flex-1 bg-background ${isDark ? "dark" : ""}`}
        >
          <SafeAreaView className="flex-1 bg-background">
            <View className="flex-row items-center px-4 py-3 border-b border-border">
              <Pressable onPress={handleCancelDeleteAccount} className="p-2 mr-2">
                <Ionicons name="close" size={22} color="#9ca3af" />
              </Pressable>
              <Text className="font-bold text-foreground text-base flex-1">Delete Account</Text>
            </View>

            <ScrollView className="flex-1 px-5 pt-6" keyboardShouldPersistTaps="handled">
              <View className="items-center mb-6">
                <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
                  <Ionicons name="warning" size={32} color="#ef4444" />
                </View>
                <Text className="text-foreground font-bold text-xl mb-2">This cannot be undone</Text>
                <Text className="text-muted-foreground text-sm text-center leading-5">
                  Deleting your account will permanently remove all your data, including your drink logs, badges, and profile. This action is irreversible.
                </Text>
              </View>

              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
                <Text className="text-red-700 text-sm font-medium">
                  Type DELETE to confirm
                </Text>
              </View>

              <TextInput
                className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground mb-6"
                placeholder='Type "DELETE" to confirm'
                placeholderTextColor="#9ca3af"
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <Pressable
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || deleteLoading}
                className={`rounded-xl py-4 items-center ${
                  deleteConfirmText === "DELETE" && !deleteLoading
                    ? "bg-red-500"
                    : "bg-red-200"
                }`}
              >
                <Text className="text-white font-bold text-base">
                  {deleteLoading ? "Deleting..." : "Permanently Delete Account"}
                </Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
