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

export function useLogDrink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      formData,
      sessionId,
    }: {
      userId: string;
      formData: LogDrinkFormData & { photoBase64?: string | null };
      sessionId?: string | null;
    }) => {
      // Upload photo to Storage if a local URI was provided
      let photoUrl: string | null = null;
      if (formData.photo_url) {
        photoUrl = await uploadDrinkPhoto(userId, formData.photo_url, formData.photoBase64);
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
          photo_url: photoUrl,
          rating: formData.rating || null,
          event_name: formData.event_name?.trim() || null,
          logged_at: formData.logged_at ?? new Date().toISOString(),
          session_id: sessionId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['drinkLogs', userId] });
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
      existingPhotoUrl,
      newPhotoUri,
      newPhotoBase64,
      removePhoto,
    }: {
      id: string;
      userId: string;
      formData: Omit<LogDrinkFormData, 'photo_url'>;
      existingPhotoUrl: string | null;
      newPhotoUri: string | null;
      newPhotoBase64?: string | null;
      removePhoto: boolean;
    }) => {
      let photoUrl: string | null = existingPhotoUrl;

      if (removePhoto && existingPhotoUrl) {
        const { deleteDrinkPhoto } = await import('@/lib/storage');
        await deleteDrinkPhoto(existingPhotoUrl);
        photoUrl = null;
      } else if (newPhotoUri) {
        if (existingPhotoUrl) {
          const { deleteDrinkPhoto } = await import('@/lib/storage');
          await deleteDrinkPhoto(existingPhotoUrl);
        }
        photoUrl = await uploadDrinkPhoto(userId, newPhotoUri, newPhotoBase64);
      }

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
          photo_url: photoUrl,
          rating: formData.rating || null,
          event_name: formData.event_name?.trim() || null,
          logged_at: formData.logged_at ?? new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { userId, id }) => {
      queryClient.invalidateQueries({ queryKey: ['drinkLogs', userId] });
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
      queryClient.invalidateQueries({ queryKey: ['feed', userId] });
      queryClient.invalidateQueries({ queryKey: ['userStats', userId] });
    },
  });
}
