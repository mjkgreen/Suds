import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Control, Controller, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Pressable, Text, TextInput, View } from "react-native";
import { LocationPicker } from "@/components/common/LocationPicker";
import { RemoteImage } from "@/components/common/RemoteImage";
import { ScrollPicker } from "@/components/common/ScrollPicker";
import { SimpleDateTimePicker } from "@/components/common/SimpleDateTimePicker";
import { CombinedDrinkInput } from "@/components/drink/CombinedDrinkInput";
import { DrinkTypePicker } from "@/components/drink/DrinkTypePicker";
import { LogDrinkFormData } from "@/types/models";

const RATING_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const QUANTITY_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20];

interface DrinkFormBodyProps {
  control: Control<LogDrinkFormData>;
  watch: UseFormWatch<LogDrinkFormData>;
  setValue: UseFormSetValue<LogDrinkFormData>;
  previewUri: string | null;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
  /** Edit mode only — shows Replace + Trash overlay instead of a close button */
  onReplacePhoto?: () => void;
  onClearLocation?: () => void;
  error?: string | null;
}

export function DrinkFormBody({
  control,
  watch,
  setValue,
  previewUri,
  onPickPhoto,
  onRemovePhoto,
  onReplacePhoto,
  onClearLocation,
  error,
}: DrinkFormBodyProps) {
  const [ratingPickerVisible, setRatingPickerVisible] = useState(false);
  const [quantityPickerVisible, setQuantityPickerVisible] = useState(false);

  const quantity = watch("quantity");
  const rating = watch("rating");
  const drinkType = watch("drink_type");
  const drinkName = watch("drink_name");
  const brand = watch("brand");

  return (
    <>
      {/* Drink Type */}
      <View className="mt-4 mb-6">
        <Text className="text-foreground font-semibold px-6 mb-3">Type</Text>
        <Controller
          control={control}
          name="drink_type"
          render={({ field: { value, onChange } }) => (
            <View className="px- ">
              <DrinkTypePicker value={value} onChange={onChange} />
            </View>
          )}
        />
      </View>

      <View className="px-6 gap-5">
        {/* Drink & Brand */}
        <View style={{ zIndex: 50 }}>
          <Text className="text-foreground font-semibold mb-2">Drink & Brand (optional)</Text>
          <Controller
            control={control}
            name="drink_name"
            render={() => (
              <CombinedDrinkInput
                value={drinkName && brand ? `${drinkName}, ${brand}` : drinkName || brand}
                onChange={(data) => {
                  setValue("drink_name", data.name);
                  setValue("brand", data.brand);
                  if (data.type) setValue("drink_type", data.type);
                }}
                placeholder="e.g. IPA, Guinness"
                selectedType={drinkType}
              />
            )}
          />
          <Text className="text-muted-foreground text-[10px] mt-1 ml-1 italic">
            Tip: Comma separate name and brand (e.g. IPA, Lagunitas)
          </Text>
        </View>

        {/* Rating & Quantity Row */}
        <View className="flex-row gap-4">
          <View className="flex-1">
            <Text className="text-foreground font-semibold mb-2">Rating</Text>
            <Pressable
              onPress={() => setRatingPickerVisible(true)}
              className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
            >
              <Text className="text-foreground text-base font-bold">{rating ? `${rating}/10` : "— —"}</Text>
              <Ionicons name="star" size={18} color="#f59e0b" />
            </Pressable>
          </View>
          <View className="flex-1">
            <Text className="text-foreground font-semibold mb-2">Quantity</Text>
            <Pressable
              onPress={() => setQuantityPickerVisible(true)}
              className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center justify-between"
            >
              <Text className="text-foreground text-base font-bold">{quantity}</Text>
              <Text className="text-muted-foreground text-xs">Drinks</Text>
            </Pressable>
          </View>
        </View>

        {/* When */}
        <View>
          <Text className="text-foreground font-semibold mb-2">When</Text>
          <Controller
            control={control}
            name="logged_at"
            render={({ field: { value, onChange } }) => (
              <SimpleDateTimePicker value={value || new Date().toISOString()} onChange={onChange} />
            )}
          />
        </View>

        {/* Location */}
        <View>
          <Text className="text-foreground font-semibold mb-2">Location (optional)</Text>
          <Controller
            control={control}
            name="location_name"
            render={({ field: { value } }) => (
              <LocationPicker
                value={value}
                onChange={(name, lat, lng) => {
                  setValue("location_name", name);
                  if (lat !== undefined) setValue("location_lat", lat);
                  if (lng !== undefined) setValue("location_lng", lng);
                }}
                onClear={onClearLocation}
              />
            )}
          />
        </View>

        {/* Photo */}
        <View>
          <Text className="text-foreground font-semibold mb-2">Photo (optional)</Text>
          {previewUri ? (
            <View className="relative" style={{ height: 160 }}>
              <RemoteImage uri={previewUri} height={160} borderRadius={12} />
              <View className="absolute top-2 right-2 flex-row gap-2">
                {onReplacePhoto ? (
                  <>
                    <Pressable
                      className="bg-black/50 rounded-full px-3 py-1.5 flex-row items-center gap-1"
                      onPress={onReplacePhoto}
                    >
                      <Ionicons name="swap-horizontal" size={14} color="#fff" />
                      <Text className="text-white text-xs font-medium">Replace</Text>
                    </Pressable>
                    <Pressable className="bg-red-500/80 rounded-full p-1.5" onPress={onRemovePhoto}>
                      <Ionicons name="trash" size={14} color="#fff" />
                    </Pressable>
                  </>
                ) : (
                  <Pressable className="bg-black/50 rounded-full p-1" onPress={onRemovePhoto}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            <Pressable
              className="bg-card border-2 border-dashed border-border rounded-xl py-6 items-center active:bg-accent"
              onPress={onPickPhoto}
            >
              <Ionicons name="camera-outline" size={24} color="hsl(var(--muted-foreground))" />
              <Text className="text-muted-foreground text-xs mt-1">Add a photo</Text>
            </Pressable>
          )}
        </View>

        {/* Notes */}
        <View>
          <Text className="text-foreground font-semibold mb-2">Notes (optional)</Text>
          <Controller
            control={control}
            name="notes"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
                placeholder="How was it? Any thoughts?"
                placeholderTextColor="hsl(var(--muted-foreground))"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{ minHeight: 80 }}
              />
            )}
          />
        </View>

        {error && (
          <View className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
            <Text className="text-destructive text-sm">{error}</Text>
          </View>
        )}
      </View>

      <ScrollPicker
        visible={ratingPickerVisible}
        onClose={() => setRatingPickerVisible(false)}
        onSelect={(v) => setValue("rating", v)}
        options={RATING_OPTIONS}
        selectedValue={rating ?? 0}
        title="Rate your drink"
        formatValue={(v) => (v === 0 ? "None" : `${v} / 10`)}
      />
      <ScrollPicker
        visible={quantityPickerVisible}
        onClose={() => setQuantityPickerVisible(false)}
        onSelect={(v) => setValue("quantity", v)}
        options={QUANTITY_OPTIONS}
        selectedValue={quantity}
        title="How many drinks?"
        unit="Standard"
      />
    </>
  );
}
