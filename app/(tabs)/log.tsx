import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/common/Button";
import { LocationPicker } from "@/components/common/LocationPicker";
import { RemoteImage } from "@/components/common/RemoteImage";
import { CombinedDrinkInput } from "@/components/drink/CombinedDrinkInput";
import { DrinkTypePicker } from "@/components/drink/DrinkTypePicker";
import { ScrollPicker } from "@/components/common/ScrollPicker";
import { SimpleDateTimePicker } from "@/components/common/SimpleDateTimePicker";
import { useLogDrink } from "@/hooks/useDrinkLog";
import { useLocation } from "@/hooks/useLocation";
import { useActiveSession, useEndSession } from "@/hooks/useSession";
import { useAuthStore } from "@/stores/authStore";
import { LogDrinkFormData } from "@/types/models";

const DEFAULT_VALUES: LogDrinkFormData = {
  drink_type: "beer",
  drink_name: "",
  brand: "",
  quantity: 1,
  rating: 5,
  location_name: "",
  notes: "",
  logged_at: new Date().toISOString(),
};

const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const QUANTITY_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20];

export default function LogScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { mutateAsync: logDrink } = useLogDrink();
  const { getCurrentLocation } = useLocation();
  const activeSession = useActiveSession();
  const { mutateAsync: endSession, isPending: isEnding } = useEndSession();
  
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [ratingPickerVisible, setRatingPickerVisible] = useState(false);
  const [quantityPickerVisible, setQuantityPickerVisible] = useState(false);

  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    // Faster 'will' events for iOS to avoid flashing
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Pre-fill from map click
  const params = useLocalSearchParams<{ lat?: string; lng?: string; name?: string }>();

  const { control, handleSubmit, watch, setValue, reset } = useForm<LogDrinkFormData>({
    defaultValues: {
      ...DEFAULT_VALUES,
      logged_at: new Date().toISOString(),
    },
  });

  const quantity = watch("quantity");
  const rating = watch("rating");
  const drinkType = watch("drink_type");
  const locationName = watch("location_name");
  const drinkName = watch("drink_name");
  const brand = watch("brand");
  const loggedAt = watch("logged_at") || new Date().toISOString();

  useEffect(() => {
    if (params.lat && params.lng) {
      setValue("location_lat", parseFloat(params.lat));
      setValue("location_lng", parseFloat(params.lng));
      setValue(
        "location_name",
        params.name
          ? decodeURIComponent(params.name)
          : `${parseFloat(params.lat).toFixed(4)}, ${parseFloat(params.lng).toFixed(4)}`,
      );
    }
  }, [params.lat, params.lng, params.name]);

  useFocusEffect(
    useCallback(() => {
      if (!params.lat && !params.lng && !locationName) {
        getCurrentLocation().then((result) => {
          if (result) {
            const name = result.name ?? `${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`;
            setValue("location_name", name);
            setValue("location_lat", result.lat);
            setValue("location_lng", result.lng);
          }
        });
      }
    }, [params.lat, params.lng, locationName]),
  );

  async function launchPicker(useCamera: boolean) {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    };
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  }

  function handlePickPhoto() {
    Alert.alert("Add Photo", undefined, [
      { text: "Take Photo", onPress: () => launchPicker(true) },
      { text: "Choose from Library", onPress: () => launchPicker(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function onSubmit(data: LogDrinkFormData) {
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      await logDrink({
        userId: user.id,
        formData: {
          ...data,
          photo_url: photoUri ?? undefined,
          photoBase64: photoBase64 ?? undefined,
        },
        sessionId: activeSession?.id ?? null,
      });
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      reset({ ...DEFAULT_VALUES, logged_at: new Date().toISOString() });
      setPhotoUri(null);
      setPhotoBase64(null);
      router.replace("/(tabs)/feed");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-background my-0" style={{ paddingTop: insets.top, paddingBottom: 0, marginBottom: 0 }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <View className="flex-1 relative">
          {/* Custom Header */}
          <View className="flex-row items-center justify-between px-6 py-2 bg-transparent border-b border-border/50">
            <Pressable 
              onPress={() => router.back()}
              className="py-1 pr-4"
            >
              <Text className="text-primary font-medium text-base">Cancel</Text>
            </Pressable>
            <Text className="text-lg font-bold text-foreground">Log a Drink</Text>
            <View className="w-12" /> {/* Spacer for centering */}
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 150 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Session Info */}
            <View className="px-6 pt-4 pb-0">
              {activeSession ? (
                <View className="flex-row items-center justify-between mt-2 bg-card/60 p-3 rounded-xl border border-border">
                  <View className="flex-row items-center gap-2">
                    <View className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <Text className="text-primary text-sm font-semibold">
                      At {activeSession.title ?? "Night Out"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => endSession(activeSession.id)}
                    disabled={isEnding}
                    className="bg-primary/10 rounded-lg px-2.5 py-1.5"
                  >
                    <Text className="text-primary text-[10px] font-bold uppercase tracking-wider">
                      {isEnding ? "Ending…" : "End Session"}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Text className="text-muted-foreground text-sm mt-1">Record your latest beverage</Text>
              )}
            </View>

            {/* Drink Type Selector */}
            <View className="mb-6">
              <Text className="text-foreground font-semibold px-6 mb-3">Type</Text>
              <Controller
                control={control}
                name="drink_type"
                render={({ field: { value, onChange } }) => (
                  <View className="px-6">
                    <DrinkTypePicker value={value} onChange={onChange} />
                  </View>
                )}
              />
            </View>

            <View className="px-6 gap-5">
              {/* Combined Drink Input */}
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
                    <Text className="text-foreground text-base font-bold">{rating}/10</Text>
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

              {/* Date & Time */}
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
                    />
                  )}
                />
              </View>

              {/* Photo */}
              <View>
                <Text className="text-foreground font-semibold mb-2">Photo (optional)</Text>
                {photoUri ? (
                  <View className="relative" style={{ height: 160 }}>
                    <RemoteImage uri={photoUri} height={160} borderRadius={12} />
                    <Pressable
                      className="absolute top-2 right-2 bg-black/50 rounded-full p-1"
                      onPress={() => setPhotoUri(null)}
                    >
                      <Ionicons name="close" size={18} color="#fff" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    className="bg-card border-2 border-dashed border-border rounded-xl py-6 items-center active:bg-accent"
                    onPress={handlePickPhoto}
                  >
                    <Ionicons name="camera-outline" size={24} color="#9ca3af" />
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
                      placeholderTextColor="#9ca3af"
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
          </ScrollView>

          {/* Pinned Submit Button - Hidden when typing */}
          {!isKeyboardVisible && (
            <View 
              key="footer" // Key helps with layout re-renders
              className="absolute bottom-0 left-0 right-0 px-6 bg-transparent"
              style={{ 
                paddingBottom: Math.max(insets.bottom, 15), 
                paddingTop: 0,
                marginBottom: 0
              }}
            >
              <Button
                label={photoUri && submitting ? "Uploading photo…" : "Log It"}
                onPress={handleSubmit(onSubmit)}
                loading={submitting}
                size="lg"
              />
            </View>
          )}
        </View>

        {/* Modal Pickers moved outside the relative container for better overlay behavior */}
        <ScrollPicker
          visible={ratingPickerVisible}
          onClose={() => setRatingPickerVisible(false)}
          onSelect={(v) => setValue("rating", v)}
          options={RATING_OPTIONS}
          selectedValue={rating}
          title="Rate your drink"
          unit="/ 10"
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
      </KeyboardAvoidingView>
    </View>
  );
}
