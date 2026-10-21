import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { useColorScheme } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/common/Button';
import { DrinkFormBody } from '@/components/drink/DrinkFormBody';
import { useUpdateDrinkLog } from '@/hooks/useDrinkLog';
import { useMediaPicker } from '@/hooks/useMediaPicker';
import { DrinkMedia, getDrinkMedia, LocalMedia, MAX_MEDIA } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { DrinkLog, DrinkType, LogDrinkFormData } from '@/types/models';

export default function EditDrinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { mutateAsync: updateDrink, isPending } = useUpdateDrinkLog();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [keptMedia, setKeptMedia] = useState<DrinkMedia[]>([]);
  const [newMedia, setNewMedia] = useState<LocalMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { pickFromLibrary, processing, cropper } = useMediaPicker((media) => setNewMedia((prev) => [...prev, media]));

  const { data: drink, isLoading } = useQuery({
    queryKey: ['drinkDetail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drink_logs')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as DrinkLog;
    },
    enabled: !!id,
  });

  const { control, handleSubmit, watch, setValue, reset } = useForm<LogDrinkFormData>({
    defaultValues: {
      drink_type: 'beer',
      drink_name: '',
      brand: '',
      quantity: 1,
      rating: 0,
      location_name: '',
      notes: '',
      logged_at: new Date().toISOString(),
      ended_at: undefined,
    },
  });

  useEffect(() => {
    if (!drink) return;
    reset({
      event_name: drink.event_name ?? '',
      drink_type: drink.drink_type as DrinkType,
      drink_name: drink.drink_name ?? '',
      brand: drink.brand ?? '',
      quantity: drink.quantity,
      rating: drink.rating ?? 0,
      location_name: drink.location_name ?? '',
      location_lat: drink.location_lat ?? undefined,
      location_lng: drink.location_lng ?? undefined,
      notes: drink.notes ?? '',
      logged_at: drink.logged_at,
      ended_at: drink.ended_at ?? undefined,
    });
    // Initialise photo state from existing data
    setKeptMedia(getDrinkMedia(drink));
  }, [drink]);

  const totalPhotos = keptMedia.length + newMedia.length;

  async function handleAddPhoto() {
    if (totalPhotos >= MAX_MEDIA || processing) return;
    await pickFromLibrary();
  }

  function handleRemovePhoto(index: number) {
    if (index < keptMedia.length) {
      setKeptMedia((prev) => prev.filter((_, i) => i !== index));
    } else {
      const newIndex = index - keptMedia.length;
      setNewMedia((prev) => prev.filter((_, i) => i !== newIndex));
    }
  }

  async function onSubmit(data: LogDrinkFormData) {
    if (!user || !drink) return;
    setError(null);
    try {
      await updateDrink({
        id: drink.id,
        userId: user.id,
        formData: data,
        keptMedia,
        newMedia,
      });
      router.replace(`/drink/${id}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save changes.');
    }
  }

  const previews = [...keptMedia.map((m) => ({ ...m, uri: m.url, posterUri: m.poster_url })), ...newMedia];

  if (isLoading) {
    return (
      <SafeAreaView className={`flex-1 bg-background items-center justify-center ${isDark ? 'dark' : ''}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? 'dark' : ''}`}>
      <View className="flex-1">
        {/* Nav */}
        <View className="flex-row items-center px-4 py-3 bg-background border-b border-border">
          <Pressable onPress={() => router.back()} className="p-2 mr-2">
            <Ionicons name="arrow-back" size={22} color={isDark ? '#e5e7eb' : '#374151'} />
          </Pressable>
          <Text className="font-bold text-foreground text-base flex-1">Edit Drink</Text>
          {isPending && <ActivityIndicator size="small" color="#f59e0b" />}
        </View>

        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          bottomOffset={16}
        >
          <DrinkFormBody
            control={control}
            watch={watch}
            setValue={setValue}
            previews={previews}
            onAddPhoto={handleAddPhoto}
            onRemovePhoto={handleRemovePhoto}
            addingMedia={processing}
            error={error}
          />
        </KeyboardAwareScrollView>

        {/* Pinned Save Button */}
        <View className="px-6 py-4 bg-background border-t border-border">
          <Button
            label={newMedia.length > 0 && isPending ? 'Uploading media…' : 'Save Changes'}
            onPress={handleSubmit(onSubmit)}
            loading={isPending}
            size="lg"
          />
        </View>
      </View>
      <KeyboardToolbar />
      {cropper}
    </SafeAreaView>
  );
}
