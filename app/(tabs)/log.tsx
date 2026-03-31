import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/common/Button";
import { LocationPicker } from "@/components/common/LocationPicker";
import { RemoteImage } from "@/components/common/RemoteImage";
import { DrinkTypePicker } from "@/components/drink/DrinkTypePicker";
import { useLogDrink } from "@/hooks/useDrinkLog";
import { useLocation } from "@/hooks/useLocation";
import { useActiveSession, useEndSession } from "@/hooks/useSession";
import { useAuthStore } from "@/stores/authStore";
import { LogDrinkFormData } from "@/types/models";

const DEFAULT_VALUES: LogDrinkFormData = {
  drink_type: "beer",
  drink_name: "",
  quantity: 1,
  location_name: "",
  notes: "",
};

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

  // Pre-fill from map click: /(tabs)/log?lat=xx&lng=yy&name=encoded
  const params = useLocalSearchParams<{ lat?: string; lng?: string; name?: string }>();

  const { control, handleSubmit, watch, setValue, reset } = useForm<LogDrinkFormData>({
    defaultValues: DEFAULT_VALUES,
  });

  const quantity = watch("quantity");
  const locationName = watch("location_name");

  // Apply map-selected location whenever params arrive (tab may already be mounted)
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

  // Auto-fill GPS on focus only when no location is set and no map params pending
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      reset(DEFAULT_VALUES);
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
    <SafeAreaView className="flex-1 bg-amber-50">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="px-6 pt-6 pb-4">
            <Text className="text-2xl font-bold text-gray-900">Log a Drink</Text>
            {activeSession ? (
              <View className="flex-row items-center justify-between mt-1">
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2 h-2 rounded-full bg-amber-500" />
                  <Text className="text-amber-600 text-sm font-medium">
                    Adding to: {activeSession.title ?? "Night Out"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => endSession(activeSession.id)}
                  disabled={isEnding}
                  className="bg-amber-100 rounded-full px-3 py-1"
                >
                  <Text className="text-amber-700 text-xs font-semibold">
                    {isEnding ? "Ending…" : "🏁 End Night Out"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text className="text-gray-500 text-sm mt-1">What are you having?</Text>
            )}
          </View>

          {/* Drink Type */}
          <View className="mb-6">
            <Text className="text-gray-700 font-semibold px-6 mb-3">Type</Text>
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
            {/* Drink Name */}
            <View>
              <Text className="text-gray-700 font-semibold mb-2">Drink Name (optional)</Text>
              <Controller
                control={control}
                name="drink_name"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                    placeholder="e.g. Guinness, Aperol Spritz…"
                    placeholderTextColor="#9ca3af"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
            </View>

            {/* Quantity */}
            <View>
              <Text className="text-gray-700 font-semibold mb-2">Quantity</Text>
              <View className="flex-row items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
                <Pressable
                  className="px-5 py-3 active:bg-gray-100"
                  onPress={() => setValue("quantity", Math.max(0.5, quantity - 0.5))}
                >
                  <Ionicons name="remove" size={22} color="#374151" />
                </Pressable>
                <Text className="flex-1 text-center text-xl font-bold text-gray-900">{quantity}</Text>
                <Pressable
                  className="px-5 py-3 active:bg-gray-100"
                  onPress={() => setValue("quantity", Math.min(20, quantity + 0.5))}
                >
                  <Ionicons name="add" size={22} color="#374151" />
                </Pressable>
              </View>
              <Text className="text-gray-400 text-xs mt-1">Standard drinks</Text>
            </View>

            {/* Location */}
            <View>
              <Text className="text-gray-700 font-semibold mb-2">Location (optional)</Text>
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

            {/* Notes */}
            <View>
              <Text className="text-gray-700 font-semibold mb-2">Notes (optional)</Text>
              <Controller
                control={control}
                name="notes"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
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

            {/* Photo */}
            <View>
              <Text className="text-gray-700 font-semibold mb-2">Photo (optional)</Text>
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
                  className="bg-white border-2 border-dashed border-gray-200 rounded-xl py-8 items-center active:bg-gray-50"
                  onPress={handlePickPhoto}
                >
                  <Ionicons name="camera-outline" size={28} color="#9ca3af" />
                  <Text className="text-gray-400 text-sm mt-2">Add a photo</Text>
                </Pressable>
              )}
            </View>

            {error && (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <Text className="text-red-600 text-sm">{error}</Text>
              </View>
            )}

            {/* Submit */}
            <Button
              label={photoUri && submitting ? "Uploading photo…" : "Log It"}
              onPress={handleSubmit(onSubmit)}
              loading={submitting}
              size="lg"
              className="mt-2"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
