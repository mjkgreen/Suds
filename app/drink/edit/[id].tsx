import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/common/Button';
import { DrinkFormBody } from '@/components/drink/DrinkFormBody';
import { useUpdateDrinkLog } from '@/hooks/useDrinkLog';
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

  const [keptPhotoUrls, setKeptPhotoUrls] = useState<string[]>([]);
  const [removedPhotoUrls, setRemovedPhotoUrls] = useState<string[]>([]);
  const [newPhotoUris, setNewPhotoUris] = useState<string[]>([]);
  const [newPhotoBase64s, setNewPhotoBase64s] = useState<(string | null)[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    const existing = drink.photo_urls?.length ? drink.photo_urls : drink.photo_url ? [drink.photo_url] : [];
    setKeptPhotoUrls(existing);
  }, [drink]);

  const totalPhotos = keptPhotoUrls.length + newPhotoUris.length;

  async function handleAddPhoto() {
    if (totalPhotos >= 3) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setNewPhotoUris((prev) => [...prev, result.assets[0].uri]);
      setNewPhotoBase64s((prev) => [...prev, result.assets[0].base64 ?? null]);
    }
  }

  function handleRemovePhoto(index: number) {
    if (index < keptPhotoUrls.length) {
      const url = keptPhotoUrls[index];
      setRemovedPhotoUrls((prev) => [...prev, url]);
      setKeptPhotoUrls((prev) => prev.filter((_, i) => i !== index));
    } else {
      const newIndex = index - keptPhotoUrls.length;
      setNewPhotoUris((prev) => prev.filter((_, i) => i !== newIndex));
      setNewPhotoBase64s((prev) => prev.filter((_, i) => i !== newIndex));
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
        keptPhotoUrls,
        removedPhotoUrls,
        newPhotoUris,
        newPhotoBase64s,
      });
      router.replace(`/drink/${id}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save changes.');
    }
  }

  const previewUris = [...keptPhotoUrls, ...newPhotoUris];

  if (isLoading) {
    return (
      <SafeAreaView className={`flex-1 bg-background items-center justify-center ${isDark ? 'dark' : ''}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? 'dark' : ''}`}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Nav */}
        <View className="flex-row items-center px-4 py-3 bg-background border-b border-border">
          <Pressable onPress={() => router.back()} className="p-2 mr-2">
            <Ionicons name="arrow-back" size={22} color={isDark ? '#e5e7eb' : '#374151'} />
          </Pressable>
          <Text className="font-bold text-foreground text-base flex-1">Edit Drink</Text>
          {isPending && <ActivityIndicator size="small" color="#f59e0b" />}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <DrinkFormBody
            control={control}
            watch={watch}
            setValue={setValue}
            previewUris={previewUris}
            onAddPhoto={handleAddPhoto}
            onRemovePhoto={handleRemovePhoto}
            error={error}
          />
        </ScrollView>

        {/* Pinned Save Button */}
        <View className="px-6 py-4 bg-background border-t border-border">
          <Button
            label={newPhotoUris.length > 0 && isPending ? 'Uploading photos…' : 'Save Changes'}
            onPress={handleSubmit(onSubmit)}
            loading={isPending}
            size="lg"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
