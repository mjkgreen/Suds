import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Control, Controller, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LocationPicker } from "@/components/common/LocationPicker";
import { ScrollPicker } from "@/components/common/ScrollPicker";
import { SimpleDateTimePicker } from "@/components/common/SimpleDateTimePicker";
import { AutocompleteTextInput } from "@/components/drink/AutocompleteTextInput";
import { DrinkTypePicker } from "@/components/drink/DrinkTypePicker";
import { MentionInput } from "@/components/social/MentionInput";
import { TagPeopleField } from "@/components/social/TagPeopleField";
import { getTypesForBrand, getTypesForName, searchBrands, searchDrinkNames } from "@/lib/drinkSearch";
import { formatClipLength, MAX_MEDIA, mediaAspect, MediaType } from "@/lib/media";
import { DrinkType, TaggedUser } from "@/types/models";
import { LogDrinkFormData } from "@/types/models";

const MAX_PHOTOS = MAX_MEDIA;
const THUMB_HEIGHT = 90;

const RATING_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const QUANTITY_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20];

export interface MediaPreview {
  uri: string;
  type?: MediaType;
  width?: number | null;
  height?: number | null;
  /** Videos: still frame to show as the thumbnail */
  posterUri?: string | null;
  /** Videos: length in seconds */
  duration?: number | null;
}

interface DrinkFormBodyProps {
  control: Control<LogDrinkFormData>;
  watch: UseFormWatch<LogDrinkFormData>;
  setValue: UseFormSetValue<LogDrinkFormData>;
  /** All photos/videos to display (local URIs or remote URLs), max 3 */
  previews: MediaPreview[];
  onAddPhoto: () => void;
  onRemovePhoto: (index: number) => void;
  /** Shows a spinner tile while a picked video is being prepared */
  addingMedia?: boolean;
  taggedUsers: TaggedUser[];
  onChangeTaggedUsers: (users: TaggedUser[]) => void;
  onClearLocation?: () => void;
  error?: string | null;
  /** When true, the event name field is hidden (already in an active session) */
  isInSession?: boolean;
}

export function DrinkFormBody({
  control,
  watch,
  setValue,
  previews,
  onAddPhoto,
  onRemovePhoto,
  addingMedia = false,
  taggedUsers,
  onChangeTaggedUsers,
  onClearLocation,
  error,
  isInSession = false,
}: DrinkFormBodyProps) {
  const [ratingPickerVisible, setRatingPickerVisible] = useState(false);
  const [quantityPickerVisible, setQuantityPickerVisible] = useState(false);

  const quantity = watch("quantity");
  const rating = watch("rating");
  const drinkType = watch("drink_type");
  const drinkName = watch("drink_name");
  const brand = watch("brand");

  // Only auto-switch the type when the picked entry belongs to exactly one type;
  // ambiguous entries (e.g. Jack Daniel's in cocktail + spirit) leave it alone.
  function autoSetType(types: DrinkType[]) {
    if (types.length === 1 && types[0] !== drinkType) {
      setValue("drink_type", types[0]);
    }
  }

  return (
    <>
      {/* Event Name — hidden when already in an active session */}
      {!isInSession && (
        <View className="px-6 mt-4 mb-2">
          <Text className="text-foreground font-semibold mb-2">Event / Occasion (optional)</Text>
          <Controller
            control={control}
            name="event_name"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
                placeholder="e.g. Birthday party, Game night…"
                placeholderTextColor="hsl(var(--muted-foreground))"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
              />
            )}
          />
        </View>
      )}

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
        {/* Brand */}
        <View style={{ zIndex: 60 }}>
          <Text className="text-foreground font-semibold mb-2">Brand (optional)</Text>
          <AutocompleteTextInput
            value={brand ?? ""}
            onChangeText={(text) => setValue("brand", text)}
            onSelectSuggestion={(s) => {
              setValue("brand", s.label);
              autoSetType(getTypesForBrand(s.label));
            }}
            getSuggestions={(q) => searchBrands(q, drinkType)}
            placeholder="e.g. Guinness, Moosehead"
          />
        </View>

        {/* Drink Name */}
        <View style={{ zIndex: 50 }}>
          <Text className="text-foreground font-semibold mb-2">Drink Name (optional)</Text>
          <AutocompleteTextInput
            value={drinkName ?? ""}
            onChangeText={(text) => setValue("drink_name", text)}
            onSelectSuggestion={(s) => {
              setValue("drink_name", s.label);
              autoSetType(getTypesForName(s.label));
            }}
            getSuggestions={(q) => searchDrinkNames(q, drinkType)}
            placeholder="e.g. IPA, Old Fashioned"
          />
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

        {/* Times Row */}
        <View className="flex-row gap-4">
          <View className="flex-1">
            <Text className="text-foreground font-semibold mb-2">Started At</Text>
            <Controller
              control={control}
              name="logged_at"
              render={({ field: { value, onChange } }) => (
                <SimpleDateTimePicker value={value || new Date().toISOString()} onChange={onChange} />
              )}
            />
          </View>

          {/* Ended At */}
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-foreground font-semibold">Ended At</Text>
              {watch("ended_at") && (
                <Pressable onPress={() => setValue("ended_at", undefined)}>
                  <Text className="text-destructive text-xs">Clear</Text>
                </Pressable>
              )}
            </View>
            {watch("ended_at") ? (
              <Controller
                control={control}
                name="ended_at"
                render={({ field: { value, onChange } }) => (
                  <SimpleDateTimePicker
                    value={value || ""}
                    onChange={onChange}
                    label="End Time"
                  />
                )}
              />
            ) : (
              <Pressable
                onPress={() => {
                  const baseTime = watch("logged_at") ? new Date(watch("logged_at")!) : new Date();
                  baseTime.setHours(baseTime.getHours() + 2);
                  setValue("ended_at", baseTime.toISOString());
                }}
                className="bg-card border border-border border-dashed rounded-xl px-4 py-3 items-center justify-center"
              >
                <Text className="text-muted-foreground text-sm font-medium">+ Add Time</Text>
              </Pressable>
            )}
          </View>
        </View>
        <Text className="text-muted-foreground text-[10px] mt-1 italic">
          Optional: Specify if these drinks were consumed over a period.
        </Text>

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
                  setValue("location_lat", lat);
                  setValue("location_lng", lng);
                }}
                onClear={onClearLocation}
              />
            )}
          />
        </View>

        {/* Photos */}
        <View>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-foreground font-semibold">Photos & Videos (optional)</Text>
            <Text className="text-muted-foreground text-xs">{previews.length}/{MAX_PHOTOS}</Text>
          </View>
          {previews.length === 0 && !addingMedia ? (
            <Pressable
              className="bg-card border-2 border-dashed border-border rounded-xl py-6 items-center active:bg-accent"
              onPress={onAddPhoto}
            >
              <Ionicons name="camera-outline" size={24} color="hsl(var(--muted-foreground))" />
              <Text className="text-muted-foreground text-xs mt-1">Add up to 3 photos or videos</Text>
            </Pressable>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {previews.map((preview, index) => {
                const thumbWidth = Math.round(THUMB_HEIGHT * mediaAspect(preview));
                const isVideo = preview.type === "video";
                const thumbUri = isVideo ? preview.posterUri : preview.uri;
                return (
                  <View key={index} style={{ width: thumbWidth, height: THUMB_HEIGHT }} className="relative">
                    {thumbUri ? (
                      <Image
                        source={{ uri: thumbUri }}
                        style={{ width: thumbWidth, height: THUMB_HEIGHT, borderRadius: 10 }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={{ width: thumbWidth, height: THUMB_HEIGHT, borderRadius: 10 }}
                        className="bg-black items-center justify-center"
                      >
                        <Ionicons name="videocam" size={22} color="#fff" />
                      </View>
                    )}
                    {isVideo && (
                      <View className="absolute bottom-1 left-1 flex-row items-center bg-black/60 rounded-full px-1.5 py-0.5">
                        <Ionicons name="play" size={10} color="#fff" />
                        {preview.duration ? (
                          <Text className="text-white text-[10px] ml-0.5">{formatClipLength(preview.duration)}</Text>
                        ) : null}
                      </View>
                    )}
                    <Pressable
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                      onPress={() => onRemovePhoto(index)}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                );
              })}
              {addingMedia && (
                <View
                  style={{ width: THUMB_HEIGHT, height: THUMB_HEIGHT }}
                  className="bg-card border border-border rounded-xl items-center justify-center"
                >
                  <ActivityIndicator size="small" color="#f59e0b" />
                </View>
              )}
              {!addingMedia && previews.length < MAX_PHOTOS && (
                <Pressable
                  style={{ width: THUMB_HEIGHT, height: THUMB_HEIGHT }}
                  className="bg-card border-2 border-dashed border-border rounded-xl items-center justify-center active:bg-accent"
                  onPress={onAddPhoto}
                >
                  <Ionicons name="add" size={22} color="hsl(var(--muted-foreground))" />
                  <Text className="text-muted-foreground text-[10px] mt-0.5">Add</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Notes */}
        <View>
          <Text className="text-foreground font-semibold mb-2">Notes (optional)</Text>
          <Controller
            control={control}
            name="notes"
            render={({ field: { value, onChange, onBlur } }) => (
              <MentionInput
                className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
                placeholder="How was it? Any thoughts? @mention friends"
                placeholderTextColor="hsl(var(--muted-foreground))"
                value={value ?? ""}
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

        {/* Tagged people */}
        <TagPeopleField value={taggedUsers} onChange={onChangeTaggedUsers} />

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
