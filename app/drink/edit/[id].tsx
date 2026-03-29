import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/common/Button';
import { LocationPicker } from '@/components/common/LocationPicker';
import { RemoteImage } from '@/components/common/RemoteImage';
import { DrinkTypePicker } from '@/components/drink/DrinkTypePicker';
import { useUpdateDrinkLog } from '@/hooks/useDrinkLog';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { DrinkLog, DrinkType, LogDrinkFormData } from '@/types/models';

export default function EditDrinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { mutateAsync: updateDrink, isPending } = useUpdateDrinkLog();

  const [newPhotoUri, setNewPhotoUri] = useState<string | null>(null);
  const [newPhotoBase64, setNewPhotoBase64] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
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
      quantity: 1,
      location_name: '',
      notes: '',
    },
  });

  const quantity = watch('quantity');

  // Pre-fill form once drink data loads
  useEffect(() => {
    if (!drink) return;
    reset({
      drink_type: drink.drink_type as DrinkType,
      drink_name: drink.drink_name ?? '',
      quantity: drink.quantity,
      location_name: drink.location_name ?? '',
      location_lat: drink.location_lat ?? undefined,
      location_lng: drink.location_lng ?? undefined,
      notes: drink.notes ?? '',
    });
  }, [drink]);

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setNewPhotoUri(result.assets[0].uri);
      setNewPhotoBase64(result.assets[0].base64 ?? null);
      setRemovePhoto(false);
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
        existingPhotoUrl: drink.photo_url,
        newPhotoUri,
        newPhotoBase64,
        removePhoto,
      });
      router.replace(`/drink/${id}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save changes.');
    }
  }

  // What photo to show in the preview
  const previewUri = removePhoto
    ? null
    : newPhotoUri ?? drink?.photo_url ?? null;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-amber-50 items-center justify-center">
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-amber-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Nav */}
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
          <Pressable onPress={() => router.back()} className="p-2 mr-2">
            <Ionicons name="arrow-back" size={22} color="#374151" />
          </Pressable>
          <Text className="font-bold text-gray-900 text-base flex-1">Edit Drink</Text>
          {isPending && <ActivityIndicator size="small" color="#f59e0b" />}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Drink Type */}
          <View className="mb-6 mt-4">
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
                  onPress={() => setValue('quantity', Math.max(0.5, quantity - 0.5))}
                >
                  <Ionicons name="remove" size={22} color="#374151" />
                </Pressable>
                <Text className="flex-1 text-center text-xl font-bold text-gray-900">
                  {quantity}
                </Text>
                <Pressable
                  className="px-5 py-3 active:bg-gray-100"
                  onPress={() => setValue('quantity', Math.min(20, quantity + 0.5))}
                >
                  <Ionicons name="add" size={22} color="#374151" />
                </Pressable>
              </View>
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
                      setValue('location_name', name);
                      if (lat !== undefined) setValue('location_lat', lat);
                      if (lng !== undefined) setValue('location_lng', lng);
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
                    placeholder="How was it?"
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
              {previewUri ? (
                <View className="relative" style={{ height: 180 }}>
                  <RemoteImage
                    uri={previewUri}
                    height={180}
                    borderRadius={12}
                  />
                  <View className="absolute top-2 right-2 flex-row gap-2">
                    <Pressable
                      className="bg-black/50 rounded-full px-3 py-1.5 flex-row items-center gap-1"
                      onPress={handlePickPhoto}
                    >
                      <Ionicons name="swap-horizontal" size={14} color="#fff" />
                      <Text className="text-white text-xs font-medium">Replace</Text>
                    </Pressable>
                    <Pressable
                      className="bg-red-500/80 rounded-full p-1.5"
                      onPress={() => {
                        setNewPhotoUri(null);
                        setRemovePhoto(true);
                      }}
                    >
                      <Ionicons name="trash" size={14} color="#fff" />
                    </Pressable>
                  </View>
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

            <Button
              label={newPhotoUri && isPending ? 'Uploading photo…' : 'Save Changes'}
              onPress={handleSubmit(onSubmit)}
              loading={isPending}
              size="lg"
              className="mt-2"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
