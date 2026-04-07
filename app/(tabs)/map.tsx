import { useQuery, keepPreviousData } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  Text,
  View,
} from 'react-native';
import MapView, { Callout, LongPressEvent, Marker, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrinkBadge } from '@/components/drink/DrinkBadge';
import { DrinkIcon } from '@/components/icons/DrinkIcon';
import { supabase } from '@/lib/supabase';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { useActiveSession } from '@/hooks/useSession';
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

type MapFilter = 'mine' | 'friends';

export default function MapScreen() {
  const { user } = useAuthStore();
  const activeSession = useActiveSession();
  const topEdges = activeSession ? [] : ['top' as const];
  const router = useRouter();
  const [filter, setFilter] = useState<MapFilter>('mine');
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  useEffect(() => {
    if (mapReady && userLocation) {
      mapRef.current?.animateToRegion({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }, 500);
    }
  }, [mapReady, userLocation]);

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
    queryKey: ['mapLogs', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      const ids = (follows as { following_id: string }[] | null ?? []).map((f) => f.following_id);
      const allIds = [user.id, ...ids];

      const { data, error } = await supabase
        .from('drink_logs')
        .select('*, profile:profiles(id, username, display_name, avatar_url)')
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null)
        .in('user_id', allIds)
        .order('logged_at', { ascending: false })
        .limit(300);

      if (error) throw error;
      return data as (DrinkLog & { profile: any })[];
    },
    enabled: !!user,
  });



  // Group nearby logs into clusters (~100m radius via 3-decimal rounding)
  const clusters = useMemo(() => {
    const groups = new Map<string, { items: (DrinkLog & { profile: any })[], isMine: boolean }>();
    for (const log of logs ?? []) {
      if (!log.location_lat || !log.location_lng) continue;
      const isMine = log.user_id === user?.id;
      const key = `${isMine ? 'mine' : 'friend'}-${log.location_lat.toFixed(3)},${log.location_lng.toFixed(3)}`;
      const existing = groups.get(key) ?? { items: [], isMine };
      groups.set(key, { ...existing, items: [...existing.items, log] });
    }
    return Array.from(groups.entries()).map(([key, data]) => {
      const coordsPart = key.slice(key.indexOf('-') + 1);
      const [lat, lng] = coordsPart.split(',').map(Number);
      return { lat, lng, items: data.items, isMine: data.isMine };
    });
  }, [logs, user?.id]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={topEdges}>
      {/* Long-press hint */}
      <View className="absolute bottom-6 left-0 right-0 items-center z-10 pointer-events-none">
        <View className="bg-card/60 rounded-full px-4 py-2 border border-border/20">
          <Text className="text-foreground text-xs">Hold to log a drink at any location</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View className="absolute top-14 left-4 right-4 z-10 flex-row gap-2">
        {(['mine', 'friends'] as MapFilter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            className={`px-4 py-2 rounded-full shadow-sm border border-border ${filter === f ? 'bg-primary' : 'bg-card'}`}
          >
            <Text
              className={`font-semibold text-sm ${filter === f ? 'text-primary-foreground' : 'text-muted-foreground'}`}
            >
              {f === 'mine' ? 'My Drinks' : 'Friends'}
            </Text>
          </Pressable>
        ))}
      </View>

      <MapView
        ref={mapRef}
        style={{ width, height: height - 84 }}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton
        onMapReady={() => {
          setMapReady(true);
          if (userLocation) {
            mapRef.current?.animateToRegion({
              latitude: userLocation.lat,
              longitude: userLocation.lng,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }, 500);
          }
        }}
        onLongPress={handleLongPress}
      >
        {clusters.map(({ lat, lng, items, isMine }) => {
            const isVisible = filter === 'mine' ? isMine : !isMine;
            const opacity = isVisible ? 1 : 0;
            const pointerEvents = isVisible ? 'auto' : 'none';

            if (items.length === 1) {
              const log = items[0];
              const info = DRINK_TYPE_MAP[log.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
              return (
                <Marker
                  key={log.id}
                  coordinate={{ latitude: lat, longitude: lng }}
                  title={log.drink_name || info.label}
                  opacity={opacity}
                >
                  <View
                    pointerEvents={pointerEvents as any}
                    style={{ backgroundColor: info.color }}
                    className="w-9 h-9 rounded-full items-center justify-center shadow border-2 border-card"
                  >
                    <DrinkIcon type={log.drink_type as DrinkType} size={20} color="white" />
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
            }

            // Cluster: multiple drinks at this location
            const preview = items.slice(0, 3);
            return (
              <Marker
                key={`cluster-${lat}-${lng}-${isMine ? 'mine' : 'friend'}`}
                coordinate={{ latitude: lat, longitude: lng }}
                opacity={opacity}
              >
                <View className="items-center justify-center" pointerEvents={pointerEvents as any}>
                  <View className="w-11 h-11 rounded-full bg-primary items-center justify-center shadow border-2 border-card">
                    <Text className="text-primary-foreground font-bold text-sm">{items.length}</Text>
                  </View>
                </View>
                <Callout>
                  <View style={{ minWidth: 180, padding: 8 }}>
                    <Text style={{ fontWeight: '700', fontSize: 14, marginBottom: 4 }}>
                      {items.length} drinks here
                    </Text>
                    {preview.map((log) => {
                      const info = DRINK_TYPE_MAP[log.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
                      return (
                        <Text key={log.id} style={{ color: '#6b7280', fontSize: 12 }}>
                          • {log.drink_name || info.label} · @{log.profile?.username}
                        </Text>
                      );
                    })}
                    {items.length > 3 && (
                      <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>
                        +{items.length - 3} more
                      </Text>
                    )}
                  </View>
                </Callout>
              </Marker>
            );
        })}
      </MapView>

      {/* Loading overlay — keeps MapView mounted so position is preserved */}
      {isLoading && (
        <View className="absolute inset-0 items-center justify-center bg-black/10">
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      )}

      {/* Empty overlay */}
      {!isLoading && !logs?.length && (
        <View className="absolute inset-0 items-center justify-center">
          <View className="bg-card rounded-2xl px-8 py-6 mx-8 items-center shadow-lg border border-border">
            <Text className="text-3xl mb-2">🗺️</Text>
            <Text className="text-foreground font-semibold text-center">No drinks on the map yet</Text>
            <Text className="text-muted-foreground text-sm text-center mt-1">
              Log a drink with a location to see it here.
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
