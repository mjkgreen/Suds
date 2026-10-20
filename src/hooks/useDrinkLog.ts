import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DrinkMedia, LocalMedia, MAX_MEDIA } from '@/lib/media';
import { uploadDrinkMedia } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { DrinkLog, LogDrinkFormData } from '@/types/models';
import { useSessionStore } from '@/stores/sessionStore';
import * as LiveActivityBridge from 'suds-live-activity-bridge';

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function updateLiveActivity(sessionId: string | null | undefined, drinkType: string, drinkName: string): void {
  if (!sessionId) return;
  const {
    liveActivityId,
    liveActivityDrinkCount,
    liveActivityGroupDrinkCount,
    liveActivityMemberCount,
    liveActivityMemberNames,
    setLiveActivityDrinkCount,
    setLiveActivityGroupDrinkCount,
    setLiveActivityLastDrinkName,
  } = useSessionStore.getState();
  if (!liveActivityId) return;

  // The user just logged their own drink — bump both the personal and group counts.
  const newCount = liveActivityDrinkCount + 1;
  const newGroupCount = liveActivityGroupDrinkCount + 1;

  setLiveActivityDrinkCount(newCount);
  setLiveActivityGroupDrinkCount(newGroupCount);
  setLiveActivityLastDrinkName(drinkName);
  LiveActivityBridge.updateSharedLastDrink(drinkType, drinkName);
  LiveActivityBridge.updateActivity(liveActivityId, newCount, newGroupCount, drinkName, liveActivityMemberCount, liveActivityMemberNames).catch(
    (e) => { console.warn('[LiveActivity] updateActivity failed:', e); },
  );
}

/**
 * Values for the legacy photo_url / photo_urls columns. Videos contribute their
 * poster so older app builds still show something.
 */
function legacyPhotoUrls(media: DrinkMedia[]): string[] {
  return media
    .map((m) => (m.type === 'image' ? m.url : m.poster_url))
    .filter((url): url is string => !!url);
}

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
      media,
    }: {
      userId: string;
      formData: LogDrinkFormData;
      sessionId?: string | null;
      media?: LocalMedia[];
    }) => {
      const uploaded: DrinkMedia[] = [];
      for (const item of (media ?? []).slice(0, MAX_MEDIA)) {
        uploaded.push(await uploadDrinkMedia(userId, item));
      }
      const photoUrls = legacyPhotoUrls(uploaded);

      const { data, error } = await supabase.from('drink_logs')
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
          media: uploaded as any,
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
    onSuccess: (_data, { userId, sessionId, formData }) => {
      queryClient.invalidateQueries({ queryKey: ['drinkLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['mapLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['feed', userId] });
      queryClient.invalidateQueries({ queryKey: ['userStats', userId] });
      updateLiveActivity(sessionId, formData.drink_type, formData.drink_name || capitalise(formData.drink_type));
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
      keptMedia,
      newMedia,
    }: {
      id: string;
      userId: string;
      formData: LogDrinkFormData;
      /** Existing stored media to keep. Files dropped from the drink are
       *  removed from storage by a database trigger once the update lands. */
      keptMedia: DrinkMedia[];
      /** New local files to upload */
      newMedia: LocalMedia[];
    }) => {
      // Upload new media
      const uploaded: DrinkMedia[] = [];
      for (const item of newMedia.slice(0, MAX_MEDIA - keptMedia.length)) {
        uploaded.push(await uploadDrinkMedia(userId, item));
      }

      const finalMedia = [...keptMedia, ...uploaded].slice(0, MAX_MEDIA);
      const finalPhotoUrls = legacyPhotoUrls(finalMedia);

      const { data, error } = await supabase.from('drink_logs')
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
          media: finalMedia as any,
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
      const { data, error } = await supabase.from('drink_logs')
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
    onSuccess: (_data, { userId, sessionId, item }) => {
      queryClient.invalidateQueries({ queryKey: ['drinkLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['mapLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['feed', userId] });
      queryClient.invalidateQueries({ queryKey: ['userStats', userId] });
      updateLiveActivity(sessionId, item.drink_type, item.drink_name || capitalise(item.drink_type));
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

export function useRemoveDrinkFromSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, sessionId, userId }: { id: string; sessionId: string; userId: string }) => {
      const { error } = await supabase.from('drink_logs')
        .update({ session_id: null })
        .eq('id', id);
      if (error) throw error;
      return { id, sessionId, userId };
    },
    onSuccess: (_data, { sessionId, userId, id }) => {
      queryClient.invalidateQueries({ queryKey: ['sessionDrinks', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessionDetail', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['drinkLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['feed', userId] });
      queryClient.invalidateQueries({ queryKey: ['drinkDetail', id] });
    },
  });
}
