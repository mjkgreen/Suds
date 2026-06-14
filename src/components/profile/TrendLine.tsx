import React, { useState } from "react";
import { Text, View } from "react-native";

const Y_LABEL_W = 22;
const CHART_H = 120;

function formatAxisDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface TrendLineProps {
  data: Array<{ date: string; count: number }>;
  isDark: boolean;
}

export function TrendLine({ data, isDark }: TrendLineProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const chartWidth = Math.max(containerWidth - Y_LABEL_W, 0);
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const n = data.length;
  const mutedColor = isDark ? "#6b7280" : "#9ca3af";
  const baselineColor = isDark ? "#374151" : "#e5e7eb";

  const points = data.map((d, i) => ({
    x: n > 1 ? (i / (n - 1)) * chartWidth : chartWidth / 2,
    y: CHART_H - Math.max((d.count / maxCount) * CHART_H * 0.82, d.count > 0 ? 6 : 0) - 2,
    count: d.count,
  }));

  const xLabelIndices = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]));

  return (
    <View onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: "row" }}>
        <View
          style={{
            width: Y_LABEL_W,
            height: CHART_H,
            justifyContent: "space-between",
            alignItems: "flex-end",
            paddingRight: 4,
            paddingBottom: 1,
          }}
        >
          <Text style={{ fontSize: 9, color: mutedColor, lineHeight: 12 }}>{maxCount}</Text>
          <Text style={{ fontSize: 9, color: mutedColor, lineHeight: 12 }}>0</Text>
        </View>

        <View style={{ flex: 1, height: CHART_H }}>
          <View
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, backgroundColor: baselineColor }}
          />

          {chartWidth > 0 &&
            points.slice(0, -1).map((p, i) => {
              const next = points[i + 1];
              const dx = next.x - p.x;
              const dy = next.y - p.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              return (
                <View
                  key={`seg-${i}`}
                  style={{
                    position: "absolute",
                    left: (p.x + next.x) / 2 - length / 2,
                    top: (p.y + next.y) / 2 - 1.5,
                    width: length,
                    height: 3,
                    backgroundColor: "#f59e0b",
                    borderRadius: 2,
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              );
            })}

          {chartWidth > 0 &&
            points.map((p, i) => (
              <View
                key={`dot-${i}`}
                style={{
                  position: "absolute",
                  left: p.x - 4,
                  top: p.y - 4,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: data[i].count > 0 ? "#f59e0b" : isDark ? "#374151" : "#e5e7eb",
                  borderWidth: data[i].count > 0 ? 2 : 1,
                  borderColor: data[i].count > 0 ? (isDark ? "#92400e" : "#fcd34d") : baselineColor,
                }}
              />
            ))}
        </View>
      </View>

      {chartWidth > 0 && (
        <View style={{ flexDirection: "row", marginLeft: Y_LABEL_W, height: 16 }}>
          {xLabelIndices.map((idx, pos) => (
            <Text
              key={idx}
              style={{
                position: "absolute",
                left: points[idx].x - (pos === 2 ? 32 : pos === 1 ? 16 : 0),
                fontSize: 9,
                color: mutedColor,
                textAlign: pos === 0 ? "left" : pos === 1 ? "center" : "right",
                width: 36,
              }}
            >
              {formatAxisDate(data[idx].date)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
