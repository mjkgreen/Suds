import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { addDrinkToFeedCaches, buildOptimisticFeedItem, removeDrinkFromFeedCaches } from '@/lib/feedCache';
import { useAuthStore } from '@/stores/authStore';
import { DrinkMedia, LocalMedia, MAX_MEDIA } from '@/lib/media';
import { syncDrinkTags } from '@/hooks/useDrinkTags';
import { uploadDrinkMedia } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { DrinkLog, DrinkType, LogDrinkFormData, isAlcoholicDrink } from '@/types/models';
import { useSessionStore } from '@/stores/sessionStore';
import * as LiveActivityBridge from 'suds-live-activity-bridge';
import { refreshLiveActivityCounts } from '@/hooks/useLiveActivity';

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function updateLiveActivity(
  sessionId: string | null | undefined,
  drinkType: DrinkType,
  drinkName: string,
  quantity: number,
): void {
  if (!sessionId) return;
  // Same rule as everywhere else: water etc. doesn't count, 2.5 counts 2.5.
  const added = isAlcoholicDrink(drinkType) ? Number(quantity) : 0;
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
  const newCount = Math.round((liveActivityDrinkCount + added) * 10) / 10;
  const newGroupCount = Math.round((liveActivityGroupDrinkCount + added) * 10) / 10;

  setLiveActivityDrinkCount(newCount);
  setLiveActivityGroupDrinkCount(newGroupCount);
  setLiveActivityLastDrinkName(drinkName);
  LiveActivityBridge.updateSharedLastDrink(drinkType, drinkName);
  LiveActivityBridge.updateActivity(liveActivityId, newCount, newGroupCount, drinkName, liveActivityMemberCount, liveActivityMemberNames)
    // The bump above keeps the widget's existing BAC timeline; recount from the
    // database so the new drink (with its times) reaches the widget's BAC too.
    .then(() => refreshLiveActivityCounts())
    .catch((e) => { console.warn('[LiveActivity] updateActivity failed:', e); });
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

/**
 * Ids for drinks being logged, chosen before the insert so the optimistic feed
 * entry and the saved row share one id (tapping/liking it works straight away
 * once saved, and the refetch replaces it in place). Keyed by the mutation's
 * variables: onMutate runs before mutationFn with the same object.
 */
const pendingDrinkIds = new WeakMap<object, string>();

function drinkIdFor(variables: object): string {
  let id = pendingDrinkIds.get(variables);
  if (!id) {
    id = Crypto.randomUUID();
    pendingDrinkIds.set(variables, id);
  }
  return id;
}

/** Shows a drink in the feeds right away; returns a rollback. */
function showDrinkOptimistically(
  queryClient: QueryClient,
  userId: string,
  fields: Parameters<typeof buildOptimisticFeedItem>[0],
): () => void {
  const profile = useAuthStore.getState().profile;
  if (!profile || profile.id !== userId) return () => {};
  const activeSession = useSessionStore.getState().activeSession;
  const sessionTitle = activeSession?.id === fields.session_id ? activeSession.title : null;
  return addDrinkToFeedCaches(queryClient, userId, buildOptimisticFeedItem(fields, profile), sessionTitle);
}

/** Everything that shows a user's drinks or a night out's drinks. */
function refreshAfterDrinkChange(queryClient: QueryClient, userId: string, sessionId?: string | null) {
  if (sessionId) {
    queryClient.invalidateQueries({ queryKey: ['sessionDrinks', sessionId] });
    queryClient.invalidateQueries({ queryKey: ['sessionDetail', sessionId] });
  }
  queryClient.invalidateQueries({ queryKey: ['drinkLogs', userId] });
  queryClient.invalidateQueries({ queryKey: ['mapLogs', userId] });
  queryClient.invalidateQueries({ queryKey: ['feed', userId] });
  queryClient.invalidateQueries({ queryKey: ['my-feed', userId] });
  // Every profile number that counts drinks.
  queryClient.invalidateQueries({ queryKey: ['userStats', userId] });
  queryClient.invalidateQueries({ queryKey: ['milestones', userId] });
  queryClient.invalidateQueries({ queryKey: ['streaks', userId] });
  queryClient.invalidateQueries({ queryKey: ['advancedStats', userId] });
}

/**
 * Takes a drink off any open night-out page / drink list straight away.
 * Returns a rollback.
 */
function dropFromSessionCaches(queryClient: QueryClient, drinkId: string): () => void {
  const snapshots: [readonly unknown[], unknown][] = [];
  for (const [key, data] of queryClient.getQueriesData<{ drinks: DrinkLog[] }>({ queryKey: ['sessionDetail'] })) {
    if (!data?.drinks?.some((d) => d.id === drinkId)) continue;
    snapshots.push([key, data]);
    queryClient.setQueryData(key, { ...data, drinks: data.drinks.filter((d) => d.id !== drinkId) });
  }
  for (const [key, data] of queryClient.getQueriesData<DrinkLog[]>({ queryKey: ['sessionDrinks'] })) {
    if (!Array.isArray(data) || !data.some((d) => d.id === drinkId)) continue;
    snapshots.push([key, data]);
    queryClient.setQueryData(key, data.filter((d) => d.id !== drinkId));
  }
  return () => {
    for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
  };
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

  type LogDrinkVars = {
    userId: string;
    formData: LogDrinkFormData;
    sessionId?: string | null;
    media?: LocalMedia[];
    taggedUserIds?: string[];
  };

  return useMutation({
    onMutate: (vars: LogDrinkVars) => {
      const { userId, formData, sessionId } = vars;
      const rollback = showDrinkOptimistically(queryClient, userId, {
        id: drinkIdFor(vars),
        user_id: userId,
        drink_type: formData.drink_type,
        drink_name: formData.drink_name || null,
        brand: formData.brand || null,
        quantity: formData.quantity,
        location_name: formData.location_name || null,
        location_lat: formData.location_lat ?? null,
        location_lng: formData.location_lng ?? null,
        notes: formData.notes || null,
        // Photos show once they've uploaded and the feed refetches.
        photo_url: null,
        photo_urls: [],
        media: [],
        rating: formData.rating || null,
        event_name: formData.event_name?.trim() || null,
        logged_at: formData.logged_at ?? new Date().toISOString(),
        ended_at: formData.ended_at || null,
        session_id: sessionId ?? null,
      });
      return { rollback };
    },
    mutationFn: async (vars: LogDrinkVars) => {
      const { userId, formData, sessionId, media, taggedUserIds } = vars;
      const uploaded: DrinkMedia[] = [];
      for (const item of (media ?? []).slice(0, MAX_MEDIA)) {
        uploaded.push(await uploadDrinkMedia(userId, item));
      }
      const photoUrls = legacyPhotoUrls(uploaded);

      const { data, error } = await supabase.from('drink_logs')
        .insert({
          id: drinkIdFor(vars),
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
      if (taggedUserIds?.length) await syncDrinkTags((data as DrinkLog).id, taggedUserIds);
      return data;
    },
    onError: (_err, _vars, context) => {
      context?.rollback();
    },
    onSettled: (_data, _err, { userId, sessionId }) => {
      refreshAfterDrinkChange(queryClient, userId, sessionId);
    },
    onSuccess: (_data, { sessionId, formData }) => {
      updateLiveActivity(sessionId, formData.drink_type, formData.drink_name || capitalise(formData.drink_type), formData.quantity);
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
      taggedUserIds,
    }: {
      id: string;
      userId: string;
      formData: LogDrinkFormData;
      /** Existing stored media to keep. Files dropped from the drink are
       *  removed from storage by a database trigger once the update lands. */
      keptMedia: DrinkMedia[];
      /** New local files to upload */
      newMedia: LocalMedia[];
      /** Everyone who should be tagged after the save */
      taggedUserIds: string[];
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
      await syncDrinkTags(id, taggedUserIds);
      return data;
    },
    onSuccess: (_data, { userId, id }) => {
      refreshAfterDrinkChange(queryClient, userId);
      queryClient.invalidateQueries({ queryKey: ['sessionDrinks'] });
      queryClient.invalidateQueries({ queryKey: ['sessionDetail'] });
      queryClient.invalidateQueries({ queryKey: ['drinkDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['drinkTags', id] });
    },
  });
}

export function useQuickLogDrink() {
  const queryClient = useQueryClient();

  type QuickLogVars = {
    userId: string;
    item: Pick<DrinkLog, 'drink_type' | 'drink_name' | 'brand' | 'quantity' | 'location_name' | 'location_lat' | 'location_lng'>;
    sessionId: string;
  };

  return useMutation({
    onMutate: (vars: QuickLogVars) => {
      const { userId, item, sessionId } = vars;
      const rollback = showDrinkOptimistically(queryClient, userId, {
        id: drinkIdFor(vars),
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
        photo_urls: [],
        media: [],
        rating: null,
        event_name: null,
        logged_at: new Date().toISOString(),
        ended_at: null,
        session_id: sessionId,
      });
      return { rollback };
    },
    mutationFn: async (vars: QuickLogVars) => {
      const { userId, item, sessionId } = vars;
      const { data, error } = await supabase.from('drink_logs')
        .insert({
          id: drinkIdFor(vars),
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
    onError: (_err, _vars, context) => {
      context?.rollback();
    },
    onSettled: (_data, _err, { userId, sessionId }) => {
      refreshAfterDrinkChange(queryClient, userId, sessionId);
    },
    onSuccess: (_data, { sessionId, item }) => {
      updateLiveActivity(sessionId, item.drink_type, item.drink_name || capitalise(item.drink_type), item.quantity);
    },
  });
}

export function useDeleteDrinkLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string; sessionId?: string | null }) => {
      const { error } = await supabase
        .from('drink_logs')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { id, userId };
    },
    onMutate: ({ id, userId }) => {
      const rollbackFeeds = removeDrinkFromFeedCaches(queryClient, userId, id);
      const rollbackSession = dropFromSessionCaches(queryClient, id);
      return {
        rollback: () => {
          rollbackFeeds();
          rollbackSession();
        },
      };
    },
    onError: (_err, _vars, context) => {
      context?.rollback();
    },
    onSettled: (_data, _err, { userId, sessionId }) => {
      refreshAfterDrinkChange(queryClient, userId, sessionId);
      // Session drink lists no longer poll every few seconds, so refresh
      // whichever one this drink was in.
      queryClient.invalidateQueries({ queryKey: ['sessionDrinks'] });
      queryClient.invalidateQueries({ queryKey: ['sessionDetail'] });
    },
    onSuccess: () => {
      void refreshLiveActivityCounts();
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
    onMutate: ({ id }) => ({ rollback: dropFromSessionCaches(queryClient, id) }),
    onError: (_err, _vars, context) => {
      context?.rollback();
    },
    onSettled: (_data, _err, { sessionId, userId, id }) => {
      refreshAfterDrinkChange(queryClient, userId, sessionId);
      queryClient.invalidateQueries({ queryKey: ['drinkDetail', id] });
    },
    onSuccess: () => {
      void refreshLiveActivityCounts();
    },
  });
}
