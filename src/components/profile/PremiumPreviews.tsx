import React from "react";
import { Text, View } from "react-native";
import { DrinkIcon } from "@/components/icons/DrinkIcon";
import { DRINK_TYPE_MAP } from "@/lib/constants";
import { DrinkType } from "@/types/models";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Top Drinks Preview ──────────────────────────────────────────────────────

const TOP_DRINKS_FAKE = [
  { drink_type: "beer" as DrinkType, count: 47 },
  { drink_type: "wine" as DrinkType, count: 23 },
  { drink_type: "cocktail" as DrinkType, count: 15 },
  { drink_type: "shot" as DrinkType, count: 8 },
  { drink_type: "cider" as DrinkType, count: 4 },
];
const TOP_DRINKS_TOTAL = TOP_DRINKS_FAKE.reduce((s, d) => s + d.count, 0);

export function TopDrinksPreview() {
  return (
    <View className="bg-card mx-4 mt-4 rounded-2xl border border-gray-100 p-4 gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide">Top Drinks</Text>
        <View className="flex-row gap-1.5 items-center">
          <Text className="text-xs bg-gray-100 text-gray-400 font-medium px-2 py-0.5 rounded-full">Sample data</Text>
          <Text className="text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full">Plus</Text>
        </View>
      </View>
      <View className="gap-2">
        {TOP_DRINKS_FAKE.map((d) => {
          const info = DRINK_TYPE_MAP[d.drink_type] ?? DRINK_TYPE_MAP["other"];
          const pct = (d.count / TOP_DRINKS_TOTAL) * 100;
          return (
            <View key={d.drink_type} className="flex-row items-center gap-2">
              <DrinkIcon type={d.drink_type} size={16} color={info.color} />
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className="text-xs text-gray-600 font-medium">{info.label}</Text>
                  <Text className="text-xs text-gray-400">{d.count}</Text>
                </View>
                <View className="bg-gray-100 rounded-full h-1.5">
                  <View style={{ width: `${pct}%`, backgroundColor: info.color }} className="h-1.5 rounded-full" />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Advanced Stats Preview ──────────────────────────────────────────────────

const WEEKLY_FAKE = [2, 4, 3, 5, 2, 6, 4, 3, 7, 4, 5, 3];
const BY_DAY_FAKE = [3, 8, 4, 6, 12, 18, 14]; // Sun–Sat
const MAX_WEEKLY = Math.max(...WEEKLY_FAKE);
const MAX_DAY = Math.max(...BY_DAY_FAKE);

export function AdvancedStatsPreview() {
  return (
    <View className="bg-card mx-4 mt-4 rounded-2xl border border-gray-100 p-4 gap-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide">Advanced Analytics</Text>
        <View className="flex-row gap-1.5 items-center">
          <Text className="text-xs bg-gray-100 text-gray-400 font-medium px-2 py-0.5 rounded-full">Sample data</Text>
          <Text className="text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full">Plus</Text>
        </View>
      </View>

      {/* At-a-glance numbers */}
      <View className="flex-row gap-3">
        <View className="flex-1 bg-gray-50 rounded-xl p-3">
          <Text className="text-xl font-bold text-gray-900">4.2</Text>
          <Text className="text-xs text-gray-400 mt-0.5">avg / week</Text>
        </View>
        <View className="flex-1 bg-gray-50 rounded-xl p-3">
          <Text className="text-xl font-bold text-gray-900">11</Text>
          <Text className="text-xs text-gray-400 mt-0.5">best night out</Text>
        </View>
        <View className="flex-1 bg-gray-50 rounded-xl p-3">
          <Text className="text-xl font-bold text-green-500">-12%</Text>
          <Text className="text-xs text-gray-400 mt-0.5">vs last year</Text>
        </View>
      </View>

      {/* Weekly trend */}
      <View>
        <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Last 12 Weeks</Text>
        <View className="flex-row items-end gap-0.5 h-16">
          {WEEKLY_FAKE.map((count, i) => (
            <View key={i} className="flex-1 items-center justify-end h-full">
              <View
                style={{
                  width: "100%",
                  height: `${Math.max((count / MAX_WEEKLY) * 100, 8)}%`,
                  backgroundColor: "#F59E0B",
                  borderRadius: 3,
                }}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Day-of-week */}
      <View>
        <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">By Day of Week</Text>
        <View className="flex-row items-end gap-1 h-12">
          {DAYS.map((label, dow) => {
            const count = BY_DAY_FAKE[dow];
            return (
              <View key={label} className="flex-1 items-center gap-1">
                <View className="w-full items-center justify-end" style={{ height: 40 }}>
                  <View
                    style={{
                      width: "80%",
                      height: Math.max((count / MAX_DAY) * 36, 4),
                      backgroundColor: "#F59E0B",
                      borderRadius: 3,
                    }}
                  />
                </View>
                <Text className="text-gray-400 text-xs">{label[0]}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── BAC Estimator Preview ───────────────────────────────────────────────────

export function BACEstimatorPreview() {
  const fakeBac = 0.052;
  const pct = Math.min(fakeBac / 0.25, 1) * 100;

  return (
    <View className="bg-card mx-4 mt-4 rounded-2xl border border-gray-100 p-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide">BAC Estimator</Text>
        <View className="flex-row gap-1.5 items-center">
          <Text className="text-xs bg-gray-100 text-gray-400 font-medium px-2 py-0.5 rounded-full">Sample data</Text>
          <Text className="text-xs bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full">Plus</Text>
        </View>
      </View>

      {/* Result */}
      <View className="items-center mb-4">
        <Text className="text-5xl font-bold text-gray-900">{fakeBac.toFixed(3)}</Text>
        <Text className="text-sm font-semibold mt-1 text-amber-500">Slightly impaired</Text>
        <View className="mt-3 w-full">
          <View className="bg-gray-100 rounded-full h-3 overflow-hidden">
            <View style={{ width: `${pct}%`, backgroundColor: "#F59E0B" }} className="h-3 rounded-full" />
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-xs text-gray-400">0.00</Text>
            <Text className="text-xs text-gray-400">0.08 legal limit</Text>
            <Text className="text-xs text-gray-400">0.25+</Text>
          </View>
        </View>
      </View>

      {/* Frozen inputs */}
      <View className="flex-row gap-3 mb-3">
        {[
          { label: "Drinks", value: "3" },
          { label: "Weight (lbs)", value: "165" },
          { label: "Hours", value: "2" },
          { label: "Sex", value: "M" },
        ].map((field) => (
          <View key={field.label} className="flex-1 items-center">
            <Text className="text-xs text-gray-400 mb-1">{field.label}</Text>
            <View className="bg-gray-100 rounded-xl px-3 py-2 w-full items-center">
              <Text className="text-gray-900 text-sm">{field.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text className="text-gray-400 text-xs text-center">Estimates only. Never use to determine fitness to drive.</Text>
    </View>
  );
}
