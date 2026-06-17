import React, { useMemo, useState, useEffect } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/stores/authStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { calculateBAC, getSoberTime, ProfileInput, DrinkInput } from "@/utils/bacHelpers";
import { DrinkLog, Session } from "@/types/models";

interface NightOutBACProfileProps {
  session: Session;
  drinks: DrinkLog[];
}

function BACProgressCircle({ bac, isDark }: { bac: number; isDark: boolean }) {
  // Scale BAC from 0.00 to 0.20 for the color indicator
  const pct = Math.min(bac / 0.20, 1) * 100;
  const color = bac < 0.02 ? "#10B981" : bac < 0.05 ? "#F59E0B" : "#EF4444"; // Green for safe, Amber for impaired, Red for unsafe

  return (
    <View className="w-full mt-3">
      <View className="bg-gray-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
        <View style={{ width: `${pct}%`, backgroundColor: color }} className="h-2.5 rounded-full" />
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-[9px] text-gray-400 dark:text-gray-500">0.00</Text>
        <Text className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">0.05 threshold</Text>
        <Text className="text-[9px] text-gray-400 dark:text-gray-500">0.20+</Text>
      </View>
    </View>
  );
}

export function NightOutBACProfile({ session, drinks }: NightOutBACProfileProps) {
  const { sex } = usePrefsStore();
  const { profile } = useAuthStore();
  const weight = profile?.weight ?? 150;
  const weightUnit = (profile?.weight_unit ?? 'lb') as 'lb' | 'kg';
  const isActive = !session.ended_at;

  // Timer for active sessions (ticks every 30 seconds)
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    if (!isActive) return;

    setCurrentTime(new Date());

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [isActive]);

  // Map session drinks to DrinkInput
  const drinkInputs = useMemo<DrinkInput[]>(() => {
    return drinks.map((d) => ({
      quantity: d.quantity,
      loggedAt: d.logged_at,
      endedAt: d.ended_at,
    }));
  }, [drinks]);

  const profileInput = useMemo<ProfileInput>(() => {
    return { sex, weight, weightUnit };
  }, [sex, weight, weightUnit]);

  // Target date for BAC calculation: now for active, session end time for completed
  const targetDate = useMemo(() => {
    return session.ended_at ? new Date(session.ended_at) : currentTime;
  }, [session.ended_at, currentTime]);

  // Current or final BAC
  const currentBAC = useMemo(() => {
    if (drinkInputs.length === 0) return 0;
    return calculateBAC(profileInput, drinkInputs, targetDate);
  }, [profileInput, drinkInputs, targetDate]);

  // Peak BAC across the entire timeline
  const peakBAC = useMemo(() => {
    if (drinkInputs.length === 0) return 0;
    const startTs = new Date(session.started_at).getTime();
    const endTs = session.ended_at ? new Date(session.ended_at).getTime() : currentTime.getTime();

    const timestampsSet = new Set<number>();
    timestampsSet.add(startTs);
    timestampsSet.add(endTs);

    for (const d of drinkInputs) {
      const tStart = new Date(d.loggedAt).getTime();
      if (!isNaN(tStart)) {
        timestampsSet.add(tStart);
      }
      if (d.endedAt) {
        const tEnd = new Date(d.endedAt).getTime();
        if (!isNaN(tEnd)) {
          timestampsSet.add(tEnd);
        }
      }
    }

    const sortedTimestamps = Array.from(timestampsSet).sort((a, b) => a - b);
    let maxBAC = 0;
    for (const ts of sortedTimestamps) {
      const bac = calculateBAC(profileInput, drinkInputs, new Date(ts));
      if (bac > maxBAC) {
        maxBAC = bac;
      }
    }
    return maxBAC;
  }, [profileInput, drinkInputs, session.started_at, session.ended_at, currentTime]);

  // Sober time
  const soberDate = useMemo(() => {
    if (drinkInputs.length === 0) return null;
    return getSoberTime(profileInput, drinkInputs);
  }, [profileInput, drinkInputs]);

  // Sober status, remaining time, and formatted sober time
  const soberCountdownStr = useMemo(() => {
    if (!soberDate) return "Sober";
    const diffMs = soberDate.getTime() - targetDate.getTime();
    if (diffMs <= 0) return "Sober";

    const diffMinutes = Math.ceil(diffMs / (1000 * 60));
    const hrs = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  }, [soberDate, targetDate]);

  const formattedSoberTime = useMemo(() => {
    if (!soberDate) return "";
    const diffMs = soberDate.getTime() - targetDate.getTime();
    if (diffMs <= 0) return "";

    const hours = soberDate.getHours();
    const minutes = soberDate.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${displayMinutes} ${ampm}`;
  }, [soberDate, targetDate]);

  // Impairment general label
  const impairmentLabel = useMemo(() => {
    const bac = currentBAC;
    if (bac === 0) return "Sober";
    if (bac < 0.02) return "Slight impairment";
    if (bac < 0.05) return "Slightly impaired";
    if (bac < 0.08) return "Impaired";
    if (bac < 0.15) return "Significantly impaired";
    return "Dangerously impaired";
  }, [currentBAC]);

  // Safe-driving status
  // - Safe: BAC < 0.02
  // - Caution/Impaired: 0.02 <= BAC < 0.05
  // - Danger/Unsafe: BAC >= 0.05
  const drivingStatus = useMemo(() => {
    const bac = currentBAC;
    if (bac < 0.02) {
      return {
        status: "Safe to Drive (Est.)",
        description: "Your BAC is under the typical driving safety threshold.",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
        borderColor: "border border-emerald-200 dark:border-emerald-800",
        titleColor: "text-emerald-700 dark:text-emerald-300",
        bodyColor: "text-emerald-600 dark:text-emerald-400",
        iconColor: "#10B981",
        icon: "car-outline" as const,
      };
    } else if (bac < 0.05) {
      return {
        status: "Caution: Impaired",
        description: "Driving is not recommended. Performance and judgment are altered.",
        bgColor: "bg-amber-50 dark:bg-amber-950/50",
        borderColor: "border border-amber-200 dark:border-amber-800",
        titleColor: "text-amber-700 dark:text-amber-300",
        bodyColor: "text-amber-600 dark:text-amber-400",
        iconColor: "#F59E0B",
        icon: "warning-outline" as const,
      };
    } else {
      return {
        status: "Unsafe to Drive",
        description: "DO NOT DRIVE! BAC exceeds safety limits. Please arrange a ride or call a cab.",
        bgColor: "bg-rose-50 dark:bg-rose-950/50",
        borderColor: "border border-rose-200 dark:border-rose-800",
        titleColor: "text-rose-700 dark:text-rose-300",
        bodyColor: "text-rose-600 dark:text-rose-400",
        iconColor: "#F43F5E",
        icon: "alert-circle-outline" as const,
      };
    }
  }, [currentBAC]);

  return (
    <View className="bg-card rounded-2xl border border-gray-200 dark:border-zinc-800 p-4 mb-4">
      {/* Header with Title and Premium indicator */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="speedometer-outline" size={18} color="#f59e0b" />
          <Text className="text-sm font-bold text-foreground">
            Night Out BAC Profile
          </Text>
        </View>
        <Text className="text-[10px] bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
          Live Estimate
        </Text>
      </View>

      {drinkInputs.length === 0 ? (
        <View className="items-center py-4">
          <Ionicons name="beer-outline" size={28} color="#9ca3af" />
          <Text className="text-xs text-muted-foreground mt-2 text-center">
            No drinks logged in this session yet. BAC cannot be estimated.
          </Text>
        </View>
      ) : (
        <View>
          {/* Main Metrics Row */}
          <View className="flex-row justify-between mb-4 mt-2">
            <View className="flex-1 items-center border-r border-gray-100 dark:border-zinc-800">
              <Text className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                {isActive ? "Current BAC" : "Final BAC"}
              </Text>
              <Text className="text-3xl font-black text-foreground mt-1">
                {currentBAC.toFixed(3)}
              </Text>
              <Text className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                {impairmentLabel}
              </Text>
            </View>

            <View className="flex-1 items-center">
              <Text className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Peak BAC
              </Text>
              <Text className="text-3xl font-black text-amber-500 dark:text-amber-400 mt-1">
                {peakBAC.toFixed(3)}
              </Text>
              <Text className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                Highest point
              </Text>
            </View>
          </View>

          {/* Visual BAC progress bar */}
          <BACProgressCircle bac={currentBAC} isDark={false} />

          {/* Driving Status Banner */}
          <View className={`rounded-xl p-3 mt-4 flex-row items-start gap-2.5 ${drivingStatus.bgColor} ${drivingStatus.borderColor}`}>
            <Ionicons name={drivingStatus.icon} size={20} color={drivingStatus.iconColor} style={{ marginTop: 2 }} />
            <View className="flex-1">
              <Text className={`text-sm font-bold leading-tight ${drivingStatus.titleColor}`}>
                {drivingStatus.status}
              </Text>
              <Text className={`text-xs mt-0.5 leading-normal ${drivingStatus.bodyColor}`}>
                {drivingStatus.description}
              </Text>
            </View>
          </View>

          {/* Sober Countdown Section */}
          <View className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3 mt-3 flex-row justify-between items-center">
            <View className="flex-1 border-r border-gray-100 dark:border-zinc-800 pr-2">
              <Text className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
                {isActive ? "Sober Countdown" : "Sober-up Time"}
              </Text>
              <Text className="text-sm font-bold text-foreground mt-0.5">
                {soberCountdownStr === "Sober"
                  ? "Fully Sober"
                  : `${soberCountdownStr} left`}
              </Text>
            </View>
            <View className="flex-1 pl-3">
              <Text className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">
                {isActive ? "Sober Time Est." : "Estimated Sober at"}
              </Text>
              <Text className="text-sm font-bold text-foreground mt-0.5">
                {formattedSoberTime ? formattedSoberTime : "Now"}
              </Text>
            </View>
          </View>

          {/* Profile reference footnote */}
          <View className="flex-row items-center justify-center gap-1 mt-3">
            <Ionicons name="person-circle-outline" size={12} color="gray" />
            <Text className="text-[9px] text-muted-foreground text-center">
              Based on your profile: {sex === "male" ? "Male" : "Female"}, {weight} {weightUnit}
            </Text>
          </View>
        </View>
      )}

      {/* Legal Disclaimer */}
      <View className="border-t border-gray-100 dark:border-zinc-800/80 pt-2.5 mt-3.5">
        <Text className="text-muted-foreground text-[9px] text-center font-medium leading-relaxed">
          Disclaimer: This is a mathematical approximation using the Widmark formula and your profile preferences. It does not replace physical testing or reflect absolute alcohol tolerance. Never use to evaluate fitness to drive.
        </Text>
      </View>
    </View>
  );
}
