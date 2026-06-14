/**
 * BAC Estimator (premium)
 *
 * Uses the Widmark formula:
 *   BAC = (drinks * 14 / (weight_kg * r * 1000)) * 100 - (0.015 * hours)
 *
 * r = 0.68 for male, 0.55 for female (body water constant)
 * 14g = standard drink alcohol weight
 *
 * This is an estimate only and should never be used to determine
 * fitness to drive. We display a clear disclaimer.
 */

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Text, TextInput, View, ActivityIndicator, Pressable } from "react-native";
import { useAuthStore } from "@/stores/authStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { useActiveSession, useSessionDrinks } from "@/hooks/useSession";
import { calculateBAC, getSoberTime, ProfileInput, DrinkInput } from "@/utils/bacHelpers";
import { DrinkLog } from "@/types/models";
import { Ionicons } from "@expo/vector-icons";

function BACBar({ bac }: { bac: number }) {
  // Scale: 0.00 (sober) → 0.25+ (very drunk), color-coded
  const pct = Math.min(bac / 0.25, 1) * 100;
  const color = bac < 0.04 ? "#22C55E" : bac < 0.08 ? "#F59E0B" : "#EF4444";

  return (
    <View className="mt-3 w-full">
      <View className="bg-gray-100 dark:bg-zinc-800 rounded-full h-3 overflow-hidden">
        <View style={{ width: `${pct}%`, backgroundColor: color }} className="h-3 rounded-full" />
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-[10px] text-gray-400 dark:text-gray-500">0.00</Text>
        <Text className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">0.08 legal limit</Text>
        <Text className="text-[10px] text-gray-400 dark:text-gray-500">0.25+</Text>
      </View>
    </View>
  );
}

export function BACEstimator() {
  const { sex } = usePrefsStore();
  const { profile } = useAuthStore();
  const weight = profile?.weight ?? 150;
  const weightUnit = (profile?.weight_unit ?? 'lb') as 'lb' | 'kg';
  const activeSession = useActiveSession();
  const { data: sessionDrinks, isLoading: isLoadingDrinks } = useSessionDrinks(activeSession?.id);

  // Mode state: tracks whether in 'Live Mode' or 'Manual Mode'
  const [mode, setMode] = useState<'live' | 'manual'>('manual');
  const lastSessionIdRef = useRef<string | null>(null);

  // Sync mode to 'live' if active session is detected, or 'manual' otherwise, when session changes
  useEffect(() => {
    const currentSessionId = activeSession?.id || null;
    if (currentSessionId !== lastSessionIdRef.current) {
      lastSessionIdRef.current = currentSessionId;
      if (currentSessionId) {
        setMode('live');
      } else {
        setMode('manual');
      }
    }
  }, [activeSession?.id]);

  // Live calculation states and 30s timer
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    if (!activeSession) return;
    
    // Set immediate time when starting/resuming active session
    setCurrentTime(new Date());

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [activeSession?.id]);

  // Map session drinks to DrinkInput
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
    const profileInput: ProfileInput = {
      weight,
      weightUnit,
      sex,
    };
    return calculateBAC(profileInput, drinkInputs, currentTime);
  }, [weight, weightUnit, sex, drinkInputs, currentTime]);

  // Live Sober Date
  const liveSoberDate = useMemo(() => {
    const profileInput: ProfileInput = {
      weight,
      weightUnit,
      sex,
    };
    return getSoberTime(profileInput, drinkInputs);
  }, [weight, weightUnit, sex, drinkInputs]);

  // Live Sober Countdown / Format
  const soberCountdownStr = useMemo(() => {
    if (!liveSoberDate) return "Sober";
    const diffMs = liveSoberDate.getTime() - currentTime.getTime();
    if (diffMs <= 0) return "Sober";

    const diffMinutes = Math.ceil(diffMs / (1000 * 60));
    const hrs = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  }, [liveSoberDate, currentTime]);

  const formattedSoberTime = useMemo(() => {
    if (!liveSoberDate) return "";
    const diffMs = liveSoberDate.getTime() - currentTime.getTime();
    if (diffMs <= 0) return "";

    const hours = liveSoberDate.getHours();
    const minutes = liveSoberDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${displayMinutes} ${ampm}`;
  }, [liveSoberDate, currentTime]);

  const liveStatusText =
    liveBAC === 0
      ? "Sober"
      : liveBAC < 0.02
        ? "Slight impairment"
        : liveBAC < 0.05
          ? "Slightly impaired"
          : liveBAC < 0.08
            ? "Impaired"
            : liveBAC < 0.15
              ? "Significantly impaired"
              : "Dangerously impaired";

  const liveStatusColor =
    liveBAC < 0.04
      ? "text-green-600 dark:text-green-400"
      : liveBAC < 0.08
        ? "text-amber-500 dark:text-amber-400"
        : "text-red-500 dark:text-red-400";


  // Manual Mode State
  const [manualDrinks, setManualDrinks] = useState("2");
  const [manualHours, setManualHours] = useState("1");

  const manualBAC = useMemo(() => {
    const d = parseFloat(manualDrinks);
    let w = weight;
    if (weightUnit === 'lb') {
      w = w * 0.45359237;
    }
    const h = parseFloat(manualHours);
    if (isNaN(d) || isNaN(w) || isNaN(h) || w <= 0) return 0;

    const r = sex === "male" ? 0.68 : 0.55;
    const raw = ((d * 14) / (w * r * 1000)) * 100;
    const metabolized = 0.015 * h;
    return Math.max(raw - metabolized, 0);
  }, [manualDrinks, manualHours, weight, weightUnit, sex]);

  const manualStatusText =
    manualBAC === 0
      ? "Sober"
      : manualBAC < 0.02
        ? "Slight impairment"
        : manualBAC < 0.05
          ? "Slightly impaired"
          : manualBAC < 0.08
            ? "Impaired"
            : manualBAC < 0.15
              ? "Significantly impaired"
              : "Dangerously impaired";

  const manualStatusColor =
    manualBAC < 0.04
      ? "text-green-600 dark:text-green-400"
      : manualBAC < 0.08
        ? "text-amber-500 dark:text-amber-400"
        : "text-red-500 dark:text-red-400";

  return (
    <View className="bg-card mx-4 mt-4 rounded-2xl border border-gray-200 dark:border-zinc-800 p-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="speedometer-outline" size={16} color="#f59e0b" />
          <Text className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wide">
            BAC Estimator
          </Text>
        </View>
        <Text className="text-xs bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold px-2.5 py-0.5 rounded-full">
          Plus
        </Text>
      </View>

      {/* Mode Switcher */}
      <View className="flex-row bg-gray-100 dark:bg-zinc-800 rounded-xl p-1 mb-4">
        <Pressable
          onPress={() => setMode('live')}
          className={`flex-1 py-1.5 rounded-lg items-center justify-center flex-row gap-1 ${
            mode === 'live' ? 'bg-amber-500' : ''
          }`}
        >
          <Ionicons
            name="flash"
            size={12}
            color={mode === 'live' ? '#fff' : '#6b7280'}
          />
          <Text
            className={`text-xs font-semibold ${
              mode === 'live' ? 'text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Live Session
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('manual')}
          className={`flex-1 py-1.5 rounded-lg items-center justify-center flex-row gap-1 ${
            mode === 'manual' ? 'bg-amber-500' : ''
          }`}
        >
          <Ionicons
            name="options"
            size={12}
            color={mode === 'manual' ? '#fff' : '#6b7280'}
          />
          <Text
            className={`text-xs font-semibold ${
              mode === 'manual' ? 'text-white' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Manual Calc
          </Text>
        </Pressable>
      </View>

      {/* Main Content Area */}
      {mode === 'live' ? (
        // LIVE MODE VIEW
        !activeSession ? (
          <View className="items-center py-6 px-4">
            <Ionicons name="moon-outline" size={32} color="#9ca3af" />
            <Text className="text-sm font-semibold text-gray-900 dark:text-white mt-2 text-center">
              No Active Session
            </Text>
            <Text className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
              Start a night out from the home feed or drink logger to track live estimations.
            </Text>
          </View>
        ) : isLoadingDrinks ? (
          <View className="items-center py-8">
            <ActivityIndicator size="small" color="#f59e0b" />
          </View>
        ) : (
          <View>
            {/* Live Session Title */}
            <View className="flex-row items-center justify-between mb-3 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 rounded-xl">
              <View className="flex-row items-center gap-1.5 flex-1 mr-2">
                <Ionicons name="play-circle" size={14} color="#f59e0b" />
                <Text
                  numberOfLines={1}
                  className="text-xs font-semibold text-amber-800 dark:text-amber-400"
                >
                  {activeSession.title || "Active Session"}
                </Text>
              </View>
              <Text className="text-[10px] text-amber-700 dark:text-amber-500 font-medium">
                {drinkInputs.length} Drink{drinkInputs.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {/* Result display */}
            <View className="items-center mb-4">
              <Text className="text-5xl font-bold text-gray-900 dark:text-white">
                {liveBAC.toFixed(3)}
              </Text>
              <Text className={`text-sm font-semibold mt-1 ${liveStatusColor}`}>
                {liveStatusText}
              </Text>
              <BACBar bac={liveBAC} />
            </View>

            {/* Countdown / Stats Row */}
            <View className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3 mb-3 flex-row justify-between items-center">
              <View className="flex-1 border-r border-gray-100 dark:border-zinc-800 pr-2">
                <Text className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">
                  Sober Countdown
                </Text>
                <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-0.5">
                  {soberCountdownStr === "Sober" ? "Fully Sober" : soberCountdownStr}
                </Text>
              </View>
              <View className="flex-1 pl-3">
                <Text className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">
                  Sober Time Est.
                </Text>
                <Text className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-0.5">
                  {formattedSoberTime ? formattedSoberTime : "Now"}
                </Text>
              </View>
            </View>

            {/* Profile metadata footnote */}
            <View className="flex-row items-center justify-center gap-1 mb-3">
              <Ionicons name="person-circle-outline" size={12} color="#9ca3af" />
              <Text className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
                Est. using your profile: {sex === 'male' ? 'Male' : 'Female'}, {weight} {weightUnit}
              </Text>
            </View>
          </View>
        )
      ) : (
        // MANUAL MODE VIEW
        <View>
          {/* Result */}
          <View className="items-center mb-4">
            <Text className="text-5xl font-bold text-gray-900 dark:text-white">
              {manualBAC.toFixed(3)}
            </Text>
            <Text className={`text-sm font-semibold mt-1 ${manualStatusColor}`}>
              {manualStatusText}
            </Text>
            <BACBar bac={manualBAC} />
          </View>

          {/* Inputs */}
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1 items-center">
              <Text className="text-xs text-gray-400 dark:text-gray-500 mb-1">Drinks</Text>
              <TextInput
                className="bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-center text-gray-900 dark:text-white w-full font-semibold"
                keyboardType="decimal-pad"
                value={manualDrinks}
                onChangeText={setManualDrinks}
              />
            </View>
            <View className="flex-1 items-center">
              <Text className="text-xs text-gray-400 dark:text-gray-500 mb-1">Hours drinking</Text>
              <TextInput
                className="bg-gray-100 dark:bg-zinc-800 rounded-xl px-3 py-2 text-center text-gray-900 dark:text-white w-full font-semibold"
                keyboardType="decimal-pad"
                value={manualHours}
                onChangeText={setManualHours}
              />
            </View>
          </View>
          {/* Profile metadata footnote */}
          <View className="flex-row items-center justify-center gap-1 mb-1">
            <Ionicons name="person-circle-outline" size={12} color="#9ca3af" />
            <Text className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
              Using your profile: {sex === 'male' ? 'Male' : 'Female'}, {weight} {weightUnit}
            </Text>
          </View>
        </View>
      )}

      {/* Disclaimer */}
      <Text className="text-gray-400 dark:text-gray-500 text-[10px] text-center mt-1 font-medium">
        Estimates only. Never use to determine fitness to drive.
      </Text>
    </View>
  );
}
