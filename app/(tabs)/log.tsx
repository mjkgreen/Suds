import Head from 'expo-router/head';
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/common/Button";
import { DrinkFormBody } from "@/components/drink/DrinkFormBody";
import { useForm } from "react-hook-form";
import { useLogDrink } from "@/hooks/useDrinkLog";
import { useLocation } from "@/hooks/useLocation";
import { useActiveSession, useEndSession } from "@/hooks/useSession";
import { useAuthStore } from "@/stores/authStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { sanitizeGPSResult } from "@/utils/locationPrivacy";
import { LogDrinkFormData } from "@/types/models";

const DEFAULT_VALUES: LogDrinkFormData = {
  drink_type: "beer",
  drink_name: "",
  brand: "",
  quantity: 1,
  rating: 0,
  location_name: "",
  notes: "",
  logged_at: new Date().toISOString(),
};

export default function LogScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { mutateAsync: logDrink } = useLogDrink();
  const { getCurrentLocation } = useLocation();
  const activeSession = useActiveSession();
  const { mutateAsync: endSession, isPending: isEnding } = useEndSession();

  const { locationEnabled, hideAddresses } = usePrefsStore();

  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [photoBase64s, setPhotoBase64s] = useState<(string | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [locationClearedByUser, setLocationClearedByUser] = useState(false);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const params = useLocalSearchParams<{ lat?: string; lng?: string; name?: string }>();

  const { control, handleSubmit, watch, setValue, reset } = useForm<LogDrinkFormData>({
    defaultValues: { ...DEFAULT_VALUES, logged_at: new Date().toISOString() },
  });

  const locationName = watch("location_name");

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
      if (locationEnabled && !locationClearedByUser && !params.lat && !params.lng && !locationName) {
        getCurrentLocation().then((result) => {
          if (result) {
            const { name, lat, lng } = hideAddresses
              ? sanitizeGPSResult(result.lat, result.lng, result.address)
              : {
                  name: result.name ?? `${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`,
                  lat: result.lat,
                  lng: result.lng,
                };

            setValue("location_name", name);
            setValue("location_lat", lat);
            setValue("location_lng", lng);
          }
        });
      }
    }, [locationEnabled, hideAddresses, locationClearedByUser, params.lat, params.lng, locationName]),
  );

  async function handleAddPhoto() {
    if (photoUris.length >= 3) return;
    Alert.alert("Add Photo", undefined, [
      { text: "Take Photo", onPress: () => launchPicker(true) },
      { text: "Choose from Library", onPress: () => launchPicker(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function handleRemovePhoto(index: number) {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
    setPhotoBase64s((prev) => prev.filter((_, i) => i !== index));
  }

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
      setPhotoUris((prev) => [...prev, result.assets[0].uri]);
      setPhotoBase64s((prev) => [...prev, result.assets[0].base64 ?? null]);
    }
  }

  async function onSubmit(data: LogDrinkFormData) {
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      await logDrink({
        userId: user.id,
        formData: data,
        sessionId: activeSession?.id ?? null,
        photoUris: photoUris.length > 0 ? photoUris : undefined,
        photoBase64s: photoBase64s.length > 0 ? photoBase64s : undefined,
      });
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      reset({ ...DEFAULT_VALUES, logged_at: new Date().toISOString() });
      setPhotoUris([]);
      setPhotoBase64s([]);
      setLocationClearedByUser(false);
      router.replace("/(tabs)/feed");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head><title>Log a Drink | Suds</title></Head>
      <View className="flex-1 bg-background" style={{ paddingTop: activeSession ? 0 : insets.top }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <View className="flex-1 relative">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-2 bg-transparent border-b border-border/50">
            <Pressable onPress={() => router.back()} className="py-1 pr-4">
              <Text className="text-primary font-medium text-base">Cancel</Text>
            </Pressable>
            <Text className="text-lg font-bold text-foreground">Log a Drink</Text>
            <View className="w-12" />
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 150 }}
            keyboardShouldPersistTaps="always"
          >
            {/* Session Banner */}
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

            <DrinkFormBody
              control={control}
              watch={watch}
              setValue={setValue}
              previewUris={photoUris}
              onAddPhoto={handleAddPhoto}
              onRemovePhoto={handleRemovePhoto}
              onClearLocation={() => setLocationClearedByUser(true)}
              error={error}
              isInSession={!!activeSession}
            />
          </ScrollView>

          {!isKeyboardVisible && (
            <View
              className="absolute bottom-0 left-0 right-0 px-6 bg-transparent"
              style={{ paddingBottom: Math.max(insets.bottom, 15), paddingTop: 0 }}
            >
              <Button
                label={photoUris.length > 0 && submitting ? "Uploading photos…" : "Log It"}
                onPress={handleSubmit(onSubmit)}
                loading={submitting}
                size="lg"
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
      </View>
    </>
  );
}
