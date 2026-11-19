import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { pendingInvites, usePendingInvite } from "@/hooks/useShareLinks";

/**
 * On sign-up / sign-in: reminds people the invite they opened is waiting
 * ("Join Sam's night out"), and lets them drop it.
 */
export function PendingInviteBanner() {
  const invite = usePendingInvite();
  if (!invite) return null;
  return (
    <View className="flex-row items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
      <Ionicons name="people-outline" size={18} color="#d97706" />
      <Text className="text-amber-800 text-sm flex-1">
        {invite.label ?? "Your invite"} — we'll take you there once you're in.
      </Text>
      <Pressable onPress={() => void pendingInvites.clear()} hitSlop={8} accessibilityLabel="Dismiss invite">
        <Ionicons name="close" size={16} color="#92400e" />
      </Pressable>
    </View>
  );
}
