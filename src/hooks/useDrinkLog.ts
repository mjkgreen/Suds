import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    }: {
      userId: string;
      formData: LogDrinkFormData;
    }) => {
      const { data, error } = await supabase
        .from('drink_logs')
        .insert({
          user_id: userId,
          drink_type: formData.drink_type,
          drink_name: formData.drink_name || null,
          quantity: formData.quantity,
          location_name: formData.location_name || null,
          location_lat: formData.location_lat ?? null,
          location_lng: formData.location_lng ?? null,
          notes: formData.notes || null,
          photo_url: formData.photo_url ?? null,
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
