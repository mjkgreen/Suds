/**
 * LiveBACCard (premium)
 *
 * Shown when the user has an active session. Auto-calculates BAC
 * from the session's actual drink timestamps using the Widmark formula,
 * refreshing every 60 seconds.
 *
 * Formula per session:
 *   BAC = max(0, (totalDrinks * 14 / (weight_kg * r * 1000)) * 100 - 0.015 * hoursFromFirstDrink)
 *
 * r: male=0.68, female=0.55, other=0.615
 */

import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useAuthStore } from "@/stores/authStore";
import { useActiveSession, useSessionDrinks } from "@/hooks/useSession";
import { DrinkLog, Gender } from "@/types/models";

function widmarkR(gender: Gender | null): number {
  if (gender === "male") return 0.68;
  if (gender === "female") return 0.55;
  return 0.615;
}

function computeLiveBAC(drinks: DrinkLog[], weightKg: number, gender: Gender | null, now: Date): number {
  const alcoholicDrinks = drinks.filter(
    (d) => !["water", "soft_drink", "non_alcoholic", "mocktail"].includes(d.drink_type)
  );
  if (alcoholicDrinks.length === 0) return 0;

  const totalStandardDrinks = alcoholicDrinks.reduce((sum, d) => sum + d.quantity, 0);
  const firstDrinkTime = new Date(alcoholicDrinks[0].logged_at);
  const hoursElapsed = Math.max(0, (now.getTime() - firstDrinkTime.getTime()) / (1000 * 60 * 60));

  const r = widmarkR(gender);
  const raw = ((totalStandardDrinks * 14) / (weightKg * r * 1000)) * 100;
  const metabolized = 0.015 * hoursElapsed;
  return Math.max(raw - metabolized, 0);
}

function BACBar({ bac }: { bac: number }) {
  const pct = Math.min(bac / 0.25, 1) * 100;
  const color = bac < 0.04 ? "#22C55E" : bac < 0.08 ? "#F59E0B" : "#EF4444";
  return (
    <View className="mt-2">
      <View className="bg-white/10 rounded-full h-2 overflow-hidden">
        <View style={{ width: `${pct}%`, backgroundColor: color, height: 8, borderRadius: 4 }} />
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-xs text-gray-500">0.00</Text>
        <Text className="text-xs text-gray-500">0.08</Text>
        <Text className="text-xs text-gray-500">0.25+</Text>
      </View>
    </View>
  );
}

function formatElapsed(firstDrinkIso: string, now: Date): string {
  const ms = now.getTime() - new Date(firstDrinkIso).getTime();
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatLastUpdated(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LiveBACCard() {
  const { profile } = useAuthStore();
  const activeSession = useActiveSession();
  const { data: drinks, isLoading } = useSessionDrinks(activeSession?.id);

  const [now, setNow] = useState(() => new Date());

  // Refresh every 60s so BAC ticks down via metabolism
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const weightKg = useMemo(() => {
    if (!profile?.weight) return null;
    return profile.weight_unit === "lb" ? profile.weight * 0.453592 : profile.weight;
  }, [profile?.weight, profile?.weight_unit]);

  const missingProfile = !profile?.weight || !profile?.gender;

  const bac = useMemo(() => {
    if (!drinks || !weightKg || missingProfile) return null;
    return computeLiveBAC(drinks as DrinkLog[], weightKg, profile!.gender, now);
  }, [drinks, weightKg, missingProfile, profile, now]);

  const alcoholicCount = useMemo(
    () =>
      (drinks as DrinkLog[] | undefined)
        ?.filter((d) => !["water", "soft_drink", "non_alcoholic", "mocktail"].includes(d.drink_type))
        .reduce((s, d) => s + d.quantity, 0) ?? 0,
    [drinks]
  );

  const firstAlcoholicDrink = useMemo(
    () =>
      (drinks as DrinkLog[] | undefined)?.find(
        (d) => !["water", "soft_drink", "non_alcoholic", "mocktail"].includes(d.drink_type)
      ),
    [drinks]
  );

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
    bac === null
      ? "#6b7280"
      : bac < 0.04
        ? "#22C55E"
        : bac < 0.08
          ? "#F59E0B"
          : "#EF4444";

  if (!activeSession) return null;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "#0f1729",
        borderWidth: 1,
        borderColor: "rgba(250,204,21,0.2)",
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.06)",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#facc15" }} />
          <Text style={{ color: "#facc15", fontWeight: "700", fontSize: 13, letterSpacing: 0.5 }}>
            LIVE BAC
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: "#6b7280", fontSize: 11 }}>Updated {formatLastUpdated(now)}</Text>
          <Text
            style={{
              backgroundColor: "rgba(250,204,21,0.15)",
              color: "#facc15",
              fontSize: 10,
              fontWeight: "700",
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            Plus
          </Text>
        </View>
      </View>

      <View style={{ padding: 16 }}>
        {isLoading ? (
          <ActivityIndicator color="#facc15" style={{ paddingVertical: 20 }} />
        ) : missingProfile ? (
          <View style={{ paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: "#6b7280", fontSize: 13, textAlign: "center" }}>
              Add your weight and biological sex in{"\n"}Edit Profile to enable live BAC.
            </Text>
          </View>
        ) : alcoholicCount === 0 ? (
          <View style={{ paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: "#6b7280", fontSize: 13 }}>No alcoholic drinks logged yet this session.</Text>
          </View>
        ) : (
          <>
            {/* Big BAC number */}
            <View style={{ alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: "#f1f5f9", fontSize: 56, fontWeight: "800", letterSpacing: -1 }}>
                {bac !== null ? bac.toFixed(3) : "—"}
              </Text>
              <Text style={{ color: statusColor, fontSize: 14, fontWeight: "600", marginTop: 2 }}>
                {statusText}
              </Text>
              {bac !== null && <BACBar bac={bac} />}
            </View>

            {/* Session stats row */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
                backgroundColor: "rgba(255,255,255,0.04)",
                borderRadius: 12,
                paddingVertical: 12,
                marginTop: 4,
              }}
            >
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#facc15", fontSize: 18, fontWeight: "700" }}>{alcoholicCount}</Text>
                <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>drinks</Text>
              </View>
              <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: "#facc15", fontSize: 18, fontWeight: "700" }}>
                  {firstAlcoholicDrink ? formatElapsed(firstAlcoholicDrink.logged_at, now) : "—"}
                </Text>
                <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>session time</Text>
              </View>
              <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: statusColor, fontSize: 18, fontWeight: "700" }}>
                  {bac !== null && bac > 0
                    ? `${Math.ceil(bac / 0.015)}h`
                    : "—"}
                </Text>
                <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>to sober</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Disclaimer */}
      <Text
        style={{
          color: "#374151",
          fontSize: 10,
          textAlign: "center",
          paddingHorizontal: 16,
          paddingBottom: 12,
        }}
      >
        Estimates only. Never use to determine fitness to drive.
      </Text>
    </View>
  );
}
