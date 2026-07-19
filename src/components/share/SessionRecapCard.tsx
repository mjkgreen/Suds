import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/common/Avatar";
import { SessionMember } from "@/types/models";
import { formatDate, formatDuration } from "@/utils/dateHelpers";

export const RECAP_CARD_WIDTH = 324;
export const RECAP_CARD_HEIGHT = 576; // 9:16, captured at 3x for stories

interface SessionRecapCardProps {
  title: string | null;
  startedAt: string;
  endedAt: string;
  members: SessionMember[];
  locations: string[];
}

// The shareable 9:16 story card for a finished night out. Deliberately
// celebrates the night — people, places, time — not drink volume.
export function SessionRecapCard({
  title,
  startedAt,
  endedAt,
  members,
  locations,
}: SessionRecapCardProps) {
  const duration = formatDuration(startedAt, endedAt);
  const crew = members.slice(0, 5);
  const crewOverflow = members.length - crew.length;

  return (
    <View
      style={{
        width: RECAP_CARD_WIDTH,
        height: RECAP_CARD_HEIGHT,
        backgroundColor: "#0f172a",
        borderRadius: 24,
        overflow: "hidden",
        padding: 28,
        justifyContent: "space-between",
      }}
    >
      {/* Ambient glow */}
      <View
        style={{
          position: "absolute",
          top: -120,
          right: -120,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: "#f59e0b",
          opacity: 0.18,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: -140,
          left: -100,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: "#f59e0b",
          opacity: 0.1,
        }}
      />

      {/* Header */}
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 18 }}>🍻</Text>
          <Text style={{ color: "#f59e0b", fontWeight: "800", fontSize: 16, letterSpacing: 3 }}>
            SUDS
          </Text>
        </View>
        <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 6, fontWeight: "600" }}>
          {formatDate(startedAt)}
        </Text>
      </View>

      {/* Night */}
      <View style={{ gap: 18 }}>
        <Text style={{ color: "#f8fafc", fontSize: 32, fontWeight: "800", lineHeight: 38 }}>
          {title ?? "Night Out"}
        </Text>

        {/* Crew */}
        {crew.length > 0 && (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row" }}>
              {crew.map((m, i) => (
                <View
                  key={m.user_id}
                  style={{
                    marginLeft: i > 0 ? -10 : 0,
                    borderWidth: 2,
                    borderColor: "#0f172a",
                    borderRadius: 20,
                  }}
                >
                  <Avatar uri={m.avatar_url} name={m.display_name ?? m.username} size={36} />
                </View>
              ))}
              {crewOverflow > 0 && (
                <View
                  style={{
                    marginLeft: -10,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "#1e293b",
                    borderWidth: 2,
                    borderColor: "#0f172a",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#f8fafc", fontSize: 11, fontWeight: "700" }}>
                    +{crewOverflow}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "600" }} numberOfLines={2}>
              {members.map((m) => m.display_name ?? m.username).filter(Boolean).join(" · ")}
            </Text>
          </View>
        )}

        {/* Location trail */}
        {locations.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
            <Ionicons name="location" size={14} color="#f59e0b" style={{ marginTop: 2 }} />
            <Text style={{ color: "#e2e8f0", fontSize: 13, fontWeight: "600", flex: 1 }} numberOfLines={3}>
              {locations.join("  →  ")}
            </Text>
          </View>
        )}

        {/* Stats row */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <RecapStat value={duration} label="out together" />
          {locations.length > 0 && (
            <RecapStat
              value={String(locations.length)}
              label={locations.length === 1 ? "spot" : "spots"}
            />
          )}
          <RecapStat value={String(members.length)} label={members.length === 1 ? "flying solo" : "crew"} />
        </View>
      </View>

      {/* Footer watermark */}
      <View style={{ gap: 2 }}>
        <Text style={{ color: "#64748b", fontSize: 11, fontWeight: "600" }}>
          Track your nights out on Suds
        </Text>
        <Text style={{ color: "#f59e0b", fontSize: 13, fontWeight: "800" }}>
          drink-with-suds.com
        </Text>
      </View>
    </View>
  );
}

function RecapStat({ value, label }: { value: string; label: string }) {
  return (
    <View
      style={{
        backgroundColor: "rgba(245, 158, 11, 0.12)",
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 14,
        alignItems: "center",
        minWidth: 72,
      }}
    >
      <Text style={{ color: "#f59e0b", fontSize: 17, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: "#94a3b8", fontSize: 10, fontWeight: "600", marginTop: 2 }}>{label}</Text>
    </View>
  );
}
