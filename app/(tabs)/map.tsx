import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  Text,
  View,
} from 'react-native';
import MapView, { Callout, LongPressEvent, Marker, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { DrinkLog, DrinkType } from '@/types/models';
import { formatDateTime } from '@/utils/dateHelpers';

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json();
    const parts = (data.display_name as string).split(', ');
    return parts.slice(0, 2).join(', ');
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

const { width, height } = Dimensions.get('window');

const INITIAL_REGION: Region = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

type MapFilter = 'mine' | 'friends' | 'all';

export default function MapScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [filter, setFilter] = useState<MapFilter>('all');

  async function handleLongPress(e: LongPressEvent) {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const name = await reverseGeocode(lat, lng);
    router.push({
      pathname: '/(tabs)/log',
      params: { lat: String(lat), lng: String(lng), name: encodeURIComponent(name) },
    });
  }

  const { data: logs, isLoading } = useQuery({
    queryKey: ['mapLogs', user?.id, filter],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('drink_logs')
        .select('*, profile:profiles(id, username, display_name, avatar_url)')
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null)
        .order('logged_at', { ascending: false })
        .limit(200);

      if (filter === 'mine') {
        query = query.eq('user_id', user.id);
      } else if (filter === 'friends') {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        const ids = (follows ?? []).map((f) => f.following_id);
        if (ids.length === 0) return [];
        query = query.in('user_id', ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (DrinkLog & { profile: any })[];
    },
    enabled: !!user,
  });

  const initialRegion = useMemo(() => {
    if (!logs?.length) return INITIAL_REGION;
    const avgLat = logs.reduce((s, l) => s + (l.location_lat ?? 0), 0) / logs.length;
    const avgLng = logs.reduce((s, l) => s + (l.location_lng ?? 0), 0) / logs.length;
    return { latitude: avgLat, longitude: avgLng, latitudeDelta: 0.1, longitudeDelta: 0.1 };
  }, [logs]);

  return (
    <SafeAreaView className="flex-1 bg-gray-900" edges={['top']}>
      {/* Long-press hint */}
      <View className="absolute bottom-6 left-0 right-0 items-center z-10 pointer-events-none">
        <View className="bg-black/60 rounded-full px-4 py-2">
          <Text className="text-white text-xs">Hold to log a drink at any location</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View className="absolute top-14 left-4 right-4 z-10 flex-row gap-2">
        {(['all', 'mine', 'friends'] as MapFilter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            className={`px-4 py-2 rounded-full shadow ${filter === f ? 'bg-amber-500' : 'bg-white'}`}
          >
            <Text
              className={`font-semibold text-sm capitalize ${filter === f ? 'text-white' : 'text-gray-700'}`}
            >
              {f === 'all' ? 'Everyone' : f === 'mine' ? 'My Drinks' : 'Friends'}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center bg-gray-100">
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : (
        <MapView
          style={{ width, height: height - 84 }}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton
          onLongPress={handleLongPress}
        >
          {(logs ?? []).map((log) => {
            if (!log.location_lat || !log.location_lng) return null;
            const info = DRINK_TYPE_MAP[log.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
            return (
              <Marker
                key={log.id}
                coordinate={{
                  latitude: log.location_lat,
                  longitude: log.location_lng,
                }}
                title={log.drink_name || info.label}
              >
                {/* Custom pin */}
                <View
                  style={{ backgroundColor: info.color }}
                  className="w-9 h-9 rounded-full items-center justify-center shadow border-2 border-white"
                >
                  <Text className="text-base">{info.emoji}</Text>
                </View>

                <Callout>
                  <View style={{ minWidth: 160, padding: 8 }}>
                    <Text style={{ fontWeight: '700', fontSize: 14 }}>
                      {log.drink_name || info.label}
                    </Text>
                    <Text style={{ color: '#6b7280', fontSize: 12 }}>
                      @{log.profile?.username}
                    </Text>
                    {log.location_name && (
                      <Text style={{ color: '#6b7280', fontSize: 12 }}>
                        📍 {log.location_name}
                      </Text>
                    )}
                    <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>
                      {formatDateTime(log.logged_at)}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>
      )}

      {/* Empty overlay */}
      {!isLoading && !logs?.length && (
        <View className="absolute inset-0 items-center justify-center">
          <View className="bg-white rounded-2xl px-8 py-6 mx-8 items-center shadow-lg">
            <Text className="text-3xl mb-2">🗺️</Text>
            <Text className="text-gray-700 font-semibold text-center">No drinks on the map yet</Text>
            <Text className="text-gray-400 text-sm text-center mt-1">
              Log a drink with a location to see it here.
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
