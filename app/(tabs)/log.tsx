import Head from 'expo-router/head';
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardToolbar } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/common/Button";
import { DrinkFormBody } from "@/components/drink/DrinkFormBody";
import { useForm } from "react-hook-form";
import { useLogDrink } from "@/hooks/useDrinkLog";
import { useLocation } from "@/hooks/useLocation";
import { usePhotoPicker } from "@/hooks/usePhotoPicker";
import { useActiveSession, useEndSession } from "@/hooks/useSession";
import { useAuthStore } from "@/stores/authStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { resolveLocationName } from "@/utils/locationPrivacy";
import { LocalMedia, MAX_MEDIA } from "@/lib/media";
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

  const [photos, setPhotos] = useState<LocalMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locationClearedByUser, setLocationClearedByUser] = useState(false);

  const insets = useSafeAreaInsets();
  const { pickPhoto, cropper } = usePhotoPicker((media) => setPhotos((prev) => [...prev, media]));

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
            const { name, lat, lng } = resolveLocationName(result, hideAddresses);

            setValue("location_name", name);
            setValue("location_lat", lat);
            setValue("location_lng", lng);
          }
        });
      }
    }, [locationEnabled, hideAddresses, locationClearedByUser, params.lat, params.lng, locationName]),
  );

  async function handleAddPhoto() {
    if (photos.length >= MAX_MEDIA) return;
    Alert.alert("Add Photo", undefined, [
      { text: "Take Photo", onPress: () => pickPhoto(true) },
      { text: "Choose from Library", onPress: () => pickPhoto(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function handleRemovePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
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
        media: photos,
      });
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      reset({ ...DEFAULT_VALUES, logged_at: new Date().toISOString() });
      setPhotos([]);
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
        <View className="flex-1 relative">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-2 bg-transparent border-b border-border/50">
            <Pressable onPress={() => router.back()} className="py-1 pr-4">
              <Text className="text-primary font-medium text-base">Cancel</Text>
            </Pressable>
            <Text className="text-lg font-bold text-foreground">Log a Drink</Text>
            <View className="w-12" />
          </View>

          <KeyboardAwareScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 150 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            bottomOffset={16}
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
              previews={photos}
              onAddPhoto={handleAddPhoto}
              onRemovePhoto={handleRemovePhoto}
              onClearLocation={() => setLocationClearedByUser(true)}
              error={error}
              isInSession={!!activeSession}
            />
          </KeyboardAwareScrollView>

          <View
            className="absolute bottom-0 left-0 right-0 px-6 bg-transparent"
            style={{ paddingBottom: Math.max(insets.bottom, 15), paddingTop: 0 }}
          >
            <Button
              label={photos.length > 0 && submitting ? "Uploading photos…" : "Log It"}
              onPress={handleSubmit(onSubmit)}
              loading={submitting}
              size="lg"
            />
          </View>
        </View>
        <KeyboardToolbar />
        {cropper}
      </View>
    </>
  );
}
