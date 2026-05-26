import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveSession, useEndSession, useSessionDrinks } from "@/hooks/useSession";
import { usePrefsStore } from "@/stores/prefsStore";
import { calculateBAC, ProfileInput, DrinkInput } from "@/utils/bacHelpers";
import { formatDuration } from "@/utils/dateHelpers";
import { DrinkLog } from "@/types/models";

export function SessionBanner() {
  const { top } = useSafeAreaInsets();
  const activeSession = useActiveSession();
  const { mutateAsync: endSession, isPending } = useEndSession();
  const [confirmEnd, setConfirmEnd] = useState(false);

  // Retrieve user BAC preferences from Zustand store
  const { sex, weight, weightUnit } = usePrefsStore();

  // Retrieve drinks for the active session
  const { data: sessionDrinks } = useSessionDrinks(activeSession?.id);

  // Set up 30-second interval timer to recalculate duration and BAC
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    if (!activeSession) return;

    setCurrentTime(new Date());

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [activeSession?.id]);

  // Handle ending the session
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

  // Calculate session duration dynamically based on the periodic timer
  const duration = useMemo(() => {
    if (!activeSession) return "";
    return formatDuration(activeSession.started_at, currentTime.toISOString());
  }, [activeSession?.started_at, currentTime]);

  // Memoize drink inputs formatted for BAC calculations
  const drinkInputs = useMemo<DrinkInput[]>(() => {
    if (!sessionDrinks) return [];
    return (sessionDrinks as DrinkLog[]).map((d) => ({
      quantity: d.quantity,
      loggedAt: d.logged_at,
      endedAt: d.ended_at,
    }));
  }, [sessionDrinks]);

  // Live BAC Calculation
  const liveBAC = useMemo(() => {
    if (!activeSession) return 0;
    const profileInput: ProfileInput = {
      weight,
      weightUnit,
      sex,
    };
    return calculateBAC(profileInput, drinkInputs, currentTime);
  }, [activeSession, weight, weightUnit, sex, drinkInputs, currentTime]);

  if (!activeSession) return null;

  // Determine background color based on BAC / driving safety
  const bannerBgColor =
    liveBAC >= 0.08
      ? "bg-red-600"
      : liveBAC > 0.0
        ? "bg-amber-500"
        : "bg-emerald-600";

  // Determine driving safety status text and icon
  const drivingStatusIcon = liveBAC >= 0.08 ? "🚫" : liveBAC > 0.0 ? "⚠️" : "✅";
  const drivingStatusText =
    liveBAC >= 0.08
      ? "Impaired (Do Not Drive)"
      : liveBAC > 0.0
        ? "Caution (Under 0.08%)"
        : "Safe to Drive";

  return (
    <View
      className={`${bannerBgColor} px-4 py-2.5 flex-row items-center justify-between`}
      style={{ paddingTop: top + 4, zIndex: 1 }}
    >
      {/* Session Details & Real-Time BAC */}
      <View className="flex-1 mr-3 justify-center">
        <View className="flex-row items-center gap-1.5 flex-wrap">
          <View className="w-1.5 h-1.5 rounded-full bg-white opacity-90" />
          <Text className="text-white font-bold text-sm" numberOfLines={1}>
            {activeSession.title ?? "Night Out"}
          </Text>
          <Text className="text-white/80 text-xs font-semibold">
            · {duration}
          </Text>
        </View>

        <View className="flex-row items-center gap-2 mt-1 flex-wrap">
          <View className="bg-white/20 px-2 py-0.5 rounded-full">
            <Text className="text-white text-[11px] font-bold">
              BAC: {liveBAC.toFixed(3)}%
            </Text>
          </View>
          <Text className="text-white text-[11px] font-semibold">
            {drivingStatusIcon} {drivingStatusText}
          </Text>
        </View>
      </View>

      {/* Control Action Button */}
      <Pressable
        onPress={handleEnd}
        disabled={isPending}
        className="bg-white/20 active:bg-white/30 rounded-full px-3.5 py-1.5 flex-row items-center gap-1 self-center"
      >
        {isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="stop-circle-outline" size={14} color="#fff" />
            <Text className="text-white text-xs font-bold">
              {confirmEnd ? "Tap again" : "End"}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
