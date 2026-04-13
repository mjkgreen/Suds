/**
 * BAC Estimator (premium)
 *
 * Uses the Widmark formula:
 *   BAC = (drinks * 14 / (weight_kg * r * 1000)) * 100 - (0.015 * hours)
 *
 * r values:
 *   male   = 0.68
 *   female = 0.55
 *   other  = 0.615 (midpoint — user can adjust manually)
 *
 * 14g = standard drink alcohol weight
 *
 * This is an estimate only and should never be used to determine
 * fitness to drive. We display a clear disclaimer.
 */

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useAuthStore } from "@/stores/authStore";
import { Gender } from "@/types/models";

function widmarkR(gender: Gender): number {
  if (gender === "male") return 0.68;
  if (gender === "female") return 0.55;
  return 0.615; // other — midpoint
}

function computeBAC(drinks: number, weightKg: number, gender: Gender, hoursElapsed: number): number {
  const r = widmarkR(gender);
  const raw = ((drinks * 14) / (weightKg * r * 1000)) * 100;
  const metabolized = 0.015 * hoursElapsed;
  return Math.max(raw - metabolized, 0);
}

function BACBar({ bac }: { bac: number }) {
  const pct = Math.min(bac / 0.25, 1) * 100;
  const color = bac < 0.04 ? "#22C55E" : bac < 0.08 ? "#F59E0B" : "#EF4444";

  return (
    <View className="mt-3">
      <View className="bg-gray-100 rounded-full h-3 overflow-hidden">
        <View style={{ width: `${pct}%`, backgroundColor: color }} className="h-3 rounded-full" />
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-xs text-gray-400">0.00</Text>
        <Text className="text-xs text-gray-400">0.08 legal limit</Text>
        <Text className="text-xs text-gray-400">0.25+</Text>
      </View>
    </View>
  );
}

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "M" },
  { value: "female", label: "F" },
  { value: "other", label: "X" },
];

export function BACEstimator() {
  const { profile } = useAuthStore();
  const [drinks, setDrinks] = useState("2");

  const initialWeight = profile?.weight?.toString() ?? "160";
  const initialWeightUnit = profile?.weight_unit ?? "lb";
  const initialGender: Gender = profile?.gender ?? "male";

  const [weight, setWeight] = useState(initialWeight);
  const [weightUnit, setWeightUnit] = useState<"lb" | "kg">(initialWeightUnit);
  const [gender, setGender] = useState<Gender>(initialGender);
  const [hours, setHours] = useState("1");

  const bac = useMemo(() => {
    const d = parseFloat(drinks);
    let w = parseFloat(weight);
    if (weightUnit === "lb") {
      w = w * 0.453592;
    }
    const h = parseFloat(hours);
    if (!d || !w || isNaN(h)) return null;
    return computeBAC(d, w, gender, h);
  }, [drinks, weight, weightUnit, gender, hours]);

  const statusText =
    bac === null
      ? "—"
      : bac < 0.02
        ? "Sober"
        : bac < 0.05
          ? "Slightly impaired"
          : bac < 0.08
            ? "Impaired"
            : bac < 0.15
              ? "Significantly impaired"
              : "Dangerously impaired";

  const statusColor =
    bac === null ? "text-gray-400" : bac < 0.04 ? "text-green-600" : bac < 0.08 ? "text-amber-500" : "text-red-500";

  return (
    <View className="bg-card mx-4 mt-4 rounded-2xl border border-gray-100 p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide">BAC Estimator</Text>
        <Text className="text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full">Plus</Text>
      </View>

      {/* Result */}
      <View className="items-center mb-4">
        <Text className="text-5xl font-bold text-gray-900">{bac !== null ? bac.toFixed(3) : "—"}</Text>
        <Text className={`text-sm font-semibold mt-1 ${statusColor}`}>{statusText}</Text>
        {bac !== null && <BACBar bac={bac} />}
      </View>

      {/* Inputs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
        className="mb-3"
      >
        <View className="items-center">
          <Text className="text-xs text-gray-400 mb-1">Drinks</Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-3 py-2 text-center text-gray-900 w-16"
            keyboardType="decimal-pad"
            value={drinks}
            onChangeText={setDrinks}
          />
        </View>
        <View className="items-center">
          <Text className="text-xs text-gray-400 mb-1">Weight ({weightUnit})</Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-3 py-2 text-center text-gray-900 w-20"
            keyboardType="decimal-pad"
            value={weight}
            onChangeText={setWeight}
          />
        </View>
        <View className="items-center">
          <Text className="text-xs text-gray-400 mb-1">Hours drinking</Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-3 py-2 text-center text-gray-900 w-20"
            keyboardType="decimal-pad"
            value={hours}
            onChangeText={setHours}
          />
        </View>
        <View className="items-center">
          <Text className="text-xs text-gray-400 mb-1">Sex</Text>
          <View className="flex-row bg-gray-100 rounded-xl overflow-hidden">
            {GENDER_OPTIONS.map(({ value, label }) => (
              <Pressable
                key={value}
                className={`px-3 py-2 ${gender === value ? "bg-amber-400" : ""}`}
                onPress={() => setGender(value)}
              >
                <Text className={`text-xs font-medium ${gender === value ? "text-white" : "text-gray-500"}`}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Disclaimer */}
      <Text className="text-gray-400 text-xs text-center">
        Estimates only. Never use to determine fitness to drive.
      </Text>
    </View>
  );
}
