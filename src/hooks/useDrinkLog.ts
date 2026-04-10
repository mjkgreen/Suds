import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadDrinkPhoto } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { DrinkLog, LogDrinkFormData } from '@/types/models';

export function useMyDrinkLogs(userId: string | undefined) {
  return useQuery({
    queryKey: ['drinkLogs', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drink_logs')
        .select('*')
        .eq('user_id', userId!)
        .order('logged_at', { ascending: false });
      if (error) throw error;
      return data as DrinkLog[];
    },
    enabled: !!userId,
  });
}

const MAX_PHOTOS = 3;

export function useLogDrink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      formData,
      sessionId,
      photoUris,
      photoBase64s,
    }: {
      userId: string;
      formData: LogDrinkFormData;
      sessionId?: string | null;
      photoUris?: string[];
      photoBase64s?: (string | null)[];
    }) => {
      // Upload all photos (max 3)
      const photoUrls: string[] = [];
      const uris = (photoUris ?? []).slice(0, MAX_PHOTOS);
      for (let i = 0; i < uris.length; i++) {
        const url = await uploadDrinkPhoto(userId, uris[i], photoBase64s?.[i] ?? null);
        photoUrls.push(url);
      }

      const { data, error } = await (supabase.from('drink_logs') as any)
        .insert({
          user_id: userId,
          drink_type: formData.drink_type,
          drink_name: formData.drink_name || null,
          brand: formData.brand || null,
          quantity: formData.quantity,
          location_name: formData.location_name || null,
          location_lat: formData.location_lat ?? null,
          location_lng: formData.location_lng ?? null,
          notes: formData.notes || null,
          photo_url: photoUrls[0] ?? null,
          photo_urls: photoUrls,
          rating: formData.rating || null,
          event_name: formData.event_name?.trim() || null,
          logged_at: formData.logged_at ?? new Date().toISOString(),
          ended_at: formData.ended_at || null,
          session_id: sessionId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['drinkLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['mapLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['feed', userId] });
      queryClient.invalidateQueries({ queryKey: ['userStats', userId] });
    },
  });
}

export function useUpdateDrinkLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      userId,
      formData,
      keptPhotoUrls,
      removedPhotoUrls,
      newPhotoUris,
      newPhotoBase64s,
    }: {
      id: string;
      userId: string;
      formData: LogDrinkFormData;
      /** Existing remote URLs to keep */
      keptPhotoUrls: string[];
      /** Existing remote URLs to delete from storage */
      removedPhotoUrls: string[];
      /** New local URIs to upload */
      newPhotoUris: string[];
      newPhotoBase64s: (string | null)[];
    }) => {
      // Delete removed photos from storage
      for (const url of removedPhotoUrls) {
        await deleteDrinkPhoto(url);
      }

      // Upload new photos
      const uploadedUrls: string[] = [];
      const uris = newPhotoUris.slice(0, MAX_PHOTOS - keptPhotoUrls.length);
      for (let i = 0; i < uris.length; i++) {
        const url = await uploadDrinkPhoto(userId, uris[i], newPhotoBase64s[i] ?? null);
        uploadedUrls.push(url);
      }

      const finalPhotoUrls = [...keptPhotoUrls, ...uploadedUrls].slice(0, MAX_PHOTOS);

      const { data, error } = await (supabase.from('drink_logs') as any)
        .update({
          drink_type: formData.drink_type,
          drink_name: formData.drink_name || null,
          brand: formData.brand || null,
          quantity: formData.quantity,
          location_name: formData.location_name || null,
          location_lat: formData.location_lat ?? null,
          location_lng: formData.location_lng ?? null,
          notes: formData.notes || null,
          photo_url: finalPhotoUrls[0] ?? null,
          photo_urls: finalPhotoUrls,
          rating: formData.rating || null,
          event_name: formData.event_name?.trim() || null,
          logged_at: formData.logged_at ?? new Date().toISOString(),
          ended_at: formData.ended_at || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { userId, id }) => {
      queryClient.invalidateQueries({ queryKey: ['drinkLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['mapLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['drinkDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['feed', userId] });
      queryClient.invalidateQueries({ queryKey: ['userStats', userId] });
    },
  });
}

export function useQuickLogDrink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      item,
      sessionId,
    }: {
      userId: string;
      item: Pick<DrinkLog, 'drink_type' | 'drink_name' | 'brand' | 'quantity' | 'location_name' | 'location_lat' | 'location_lng'>;
      sessionId: string;
    }) => {
      const { data, error } = await (supabase.from('drink_logs') as any)
        .insert({
          user_id: userId,
          drink_type: item.drink_type,
          drink_name: item.drink_name || null,
          brand: item.brand || null,
          quantity: item.quantity,
          location_name: item.location_name || null,
          location_lat: item.location_lat ?? null,
          location_lng: item.location_lng ?? null,
          notes: null,
          photo_url: null,
          rating: null,
          logged_at: new Date().toISOString(),
          session_id: sessionId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['drinkLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['mapLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['feed', userId] });
      queryClient.invalidateQueries({ queryKey: ['userStats', userId] });
    },
  });
}

export function useDeleteDrinkLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase
        .from('drink_logs')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { id, userId };
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['drinkLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['mapLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['feed', userId] });
      queryClient.invalidateQueries({ queryKey: ['userStats', userId] });
    },
  });
}
