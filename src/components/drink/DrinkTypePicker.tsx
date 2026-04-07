import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import { DrinkIcon } from "@/components/icons/DrinkIcon";
import { DRINK_TYPES } from "@/lib/constants";
import { DrinkType } from "@/types/models";

interface DrinkTypePickerProps {
  value: DrinkType;
  onChange: (type: DrinkType) => void;
}

export function DrinkTypePicker({ value, onChange }: DrinkTypePickerProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const unselectedBorder = isDark ? "#374151" : "#d1d5db";

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={{ gap: 10, paddingHorizontal: 4 }}
    >
      {DRINK_TYPES.map((type) => {
        const isSelected = value === type.value;
        return (
          <React.Fragment key={type.value}>
            <Pressable
              onPress={() => onChange(type.value)}
              style={{
                borderColor: isSelected ? type.color : unselectedBorder,
                backgroundColor: isSelected ? type.color + "15" : undefined,
              }}
              className="items-center py-3 px-4 rounded-2xl border-2 min-w-[72px] bg-card"
            >
              <View style={{ marginBottom: 4 }}>
                <DrinkIcon type={type.value} size={28} color={type.color} />
              </View>
              <Text
                style={{ color: isSelected ? type.color : "gray" }}
                className={`text-xs font-semibold  ${isSelected ? "" : "text-muted-foreground"}`}
              >
                {type.label}
              </Text>
            </Pressable>
            {type.value === "water" && (
              <View className="w-px h-[70%] self-center bg-border mx-1" />
            )}
          </React.Fragment>
        );
      })}
    </ScrollView>
  );
}
