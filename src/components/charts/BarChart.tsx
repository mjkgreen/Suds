import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

export interface Bar {
  key: string;
  value: number;
  /** Shown above the chart when the bar is tapped. */
  label: string;
  /** Text under the bar on the x-axis, or null. */
  axisLabel?: string | null;
}

interface BarChartProps {
  bars: Bar[];
  isDark: boolean;
  height?: number;
  /** Caption when no bar is selected (e.g. "42 drinks"). */
  summary: string;
  /** Formats a value for the caption, e.g. 3 → "3 drinks". */
  formatValue?: (value: number) => string;
}

const AMBER = "#f59e0b";
const Y_LABEL_W = 24;

export function formatDrinks(v: number): string {
  const n = Math.round(v * 10) / 10;
  return `${n} drink${n === 1 ? "" : "s"}`;
}

/**
 * Bar chart where every bar can be tapped to show its value. Tap the same
 * bar again (or a new range) to go back to the summary.
 */
export function BarChart({ bars, isDark, height = 160, summary, formatValue = formatDrinks }: BarChartProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  // A different data set (new range) clears the selection.
  const signature = bars.map((b) => b.key).join(",");
  useEffect(() => setSelected(null), [signature]);

  const max = Math.max(...bars.map((b) => b.value), 1);
  const muted = isDark ? "#9ca3af" : "#6b7280";
  const track = isDark ? "#27272a" : "#f3f4f6";
  const n = bars.length;
  const gap = n > 40 ? 1 : n > 16 ? 2 : 4;
  const chartW = Math.max(width - Y_LABEL_W, 0);
  const sel = bars.find((b) => b.key === selected) ?? null;

  return (
    <View>
      <View className="flex-row items-baseline justify-between mb-2" style={{ minHeight: 20 }}>
        <Text className="text-foreground text-sm font-semibold">
          {sel ? formatValue(sel.value) : summary}
        </Text>
        {sel && <Text className="text-muted-foreground text-xs">{sel.label}</Text>}
      </View>

      <View style={{ flexDirection: "row" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={{ width: Y_LABEL_W, height, justifyContent: "space-between", alignItems: "flex-end", paddingRight: 4 }}>
          <Text style={{ fontSize: 9, color: muted }}>{Math.round(max * 10) / 10}</Text>
          <Text style={{ fontSize: 9, color: muted }}>0</Text>
        </View>
        <View style={{ flex: 1, height, flexDirection: "row", alignItems: "flex-end", gap }}>
          {bars.map((b) => {
            const isSel = b.key === selected;
            const h = b.value > 0 ? Math.max((b.value / max) * height, 3) : 2;
            return (
              <Pressable
                key={b.key}
                onPress={() => setSelected(isSel ? null : b.key)}
                hitSlop={{ top: 8, bottom: 8 }}
                style={{ flex: 1, height: "100%", justifyContent: "flex-end" }}
                accessibilityRole="button"
                accessibilityLabel={`${b.label}: ${formatValue(b.value)}`}
              >
                <View
                  style={{
                    height: h,
                    borderRadius: n > 40 ? 1 : 3,
                    backgroundColor: b.value > 0 ? AMBER : track,
                    opacity: selected && !isSel ? 0.35 : 1,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {chartW > 0 && bars.some((b) => b.axisLabel) && (
        <View style={{ marginLeft: Y_LABEL_W, height: 16, marginTop: 4 }}>
          {bars.map((b, i) =>
            b.axisLabel ? (
              <Text
                key={b.key}
                numberOfLines={1}
                style={{
                  position: "absolute",
                  // Start at the bar's left edge; keep the last labels inside the chart.
                  left: Math.min((i / n) * chartW, chartW - 40),
                  width: 40,
                  fontSize: 10,
                  color: muted,
                }}
              >
                {b.axisLabel}
              </Text>
            ) : null,
          )}
        </View>
      )}
    </View>
  );
}
