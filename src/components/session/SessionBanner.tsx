import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveSession, useEndSession } from "@/hooks/useSession";
import { formatDuration } from "@/utils/dateHelpers";

export function SessionBanner() {
  const { top } = useSafeAreaInsets();
  const activeSession = useActiveSession();
  const { mutateAsync: endSession, isPending } = useEndSession();
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (!activeSession) return null;

  const duration = formatDuration(activeSession.started_at);

  async function handleEnd() {
    if (!activeSession) return;
    if (!confirmEnd) {
      setConfirmEnd(true);
      setTimeout(() => setConfirmEnd(false), 3000);
      return;
    }
    await endSession(activeSession.id);
    setConfirmEnd(false);
  }

  return (
    <View
      className="bg-amber-500 px-4 flex-row items-center justify-between"
      style={{ paddingTop: top, paddingBottom: 8, zIndex: 1 }}
    >
      <View className="flex-row items-center gap-2 flex-1">
        <View className="w-2 h-2 rounded-full bg-white opacity-90" style={{ shadowColor: "#fff" }} />
        <Text className="text-white font-semibold text-sm" numberOfLines={1}>
          {activeSession.title ?? "Night Out"} · {duration}
        </Text>
      </View>

      <Pressable
        onPress={handleEnd}
        disabled={isPending}
        className="ml-3 bg-white/20 rounded-full px-3 py-1 flex-row items-center gap-1"
      >
        {isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="stop-circle-outline" size={14} color="#fff" />
            <Text className="text-white text-xs font-semibold">{confirmEnd ? "Tap again" : "End"}</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
