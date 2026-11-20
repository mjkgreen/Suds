import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { LongPressEvent, Marker, Polyline, Region } from 'react-native-maps';
import { MapLocationSheet } from '@/components/map/MapLocationSheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DrinkIcon } from '@/components/icons/DrinkIcon';
import { buildMapClusters, fetchMapLogs, fetchSessionRoutes, isMyNightOut } from '@/lib/mapData';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { useActiveSession } from '@/hooks/useSession';
import { DrinkType, DrinkLogWithSessionAndProfile } from '@/types/models';
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

const PALETTE = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#a855f7', // Purple
];

function getPredictableColor(sessionId: string): string {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = sessionId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

export default function MapScreen() {
  const { user } = useAuthStore();
  const activeSession = useActiveSession();
  const topEdges = activeSession ? [] : ['top' as const];
  const router = useRouter();
  const [filter, setFilter] = useState<MapFilter>('mine');
  const [showRoutes, setShowRoutes] = useState(true);
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<DrinkLogWithSessionAndProfile[] | null>(null);

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

  const { data: logs, isLoading, error: logsError } = useQuery({
    queryKey: ['mapLogs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return fetchMapLogs(user.id);
    },
    enabled: !!user,
  });

  const { data: sessionsWithRoutes } = useQuery({
    queryKey: ['sessionRoutes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return fetchSessionRoutes(user.id);
    },
    enabled: !!user,
  });

  const sessionsForRoutes = useMemo(() => {
    if (!sessionsWithRoutes) return [];
    return sessionsWithRoutes.map((session) => {
      const isMine = isMyNightOut(session, user?.id);
      const isVisible = filter === 'mine' ? isMine : !isMine;
      return { ...session, isVisible };
    });
  }, [sessionsWithRoutes, filter, user?.id]);

  // Nearby drinks grouped into My Drinks / Friends pins (src/lib/mapData.ts)
  const clusters = useMemo(() => buildMapClusters(logs, user?.id), [logs, user?.id]);

  // Pins are what the map is for: show them as soon as they're here (or
  // saved from last time) instead of waiting on the slower routes query.
  // Routes just appear when they arrive, and a routes failure isn't worth
  // covering the pins with an error.
  const showLoading = isLoading;
  const showError = !showLoading && !!logsError && !logs;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={topEdges}>
      {/* Long-press hint */}
      <View className="absolute bottom-6 left-0 right-0 items-center z-10 pointer-events-none">
        <View className="bg-card/60 rounded-full px-4 py-2 border border-border/20">
          <Text className="text-foreground text-xs">Hold to log a drink at any location</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterContainer} className="z-10 flex-row gap-2">
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

        {/* Toggle Route Chip */}
        <Pressable
          onPress={async () => {
            setShowRoutes((prev) => !prev);
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) {
              // Ignore haptic errors if not supported
            }
          }}
          className={`px-4 py-2 rounded-full shadow-sm border border-border flex-row items-center gap-1.5 ${
            showRoutes ? 'bg-primary' : 'bg-card'
          }`}
        >
          <Ionicons
            name={showRoutes ? 'eye' : 'eye-off'}
            size={16}
            color={showRoutes ? '#ffffff' : '#6b7280'}
          />
          <Text
            className={`font-semibold text-sm ${
              showRoutes ? 'text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            {showRoutes ? 'Hide Routes' : 'Show Routes'}
          </Text>
        </Pressable>
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
        {/* Render Route Polylines — always mounted, visibility via strokeOpacity to avoid map crashes on toggle */}
        {sessionsForRoutes.map((session) => {
          if (!session.route || session.route.length < 2) return null;
          const baseColor = getPredictableColor(session.id);
          const lineDashPattern = session.ended_at ? [5, 5] : undefined;
          const visible = showRoutes && session.isVisible;

          return (
            <Polyline
              key={`polyline-${session.id}`}
              coordinates={session.route}
              strokeColor={visible ? baseColor : '#00000000'}
              strokeWidth={4}
              lineDashPattern={lineDashPattern}
              tappable={visible}
              onPress={() => {
                if (visible) router.push(`/session/${session.id}`);
              }}
            />
          );
        })}

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
                  opacity={opacity}
                  calloutEnabled={false}
                  onPress={() => { if (isVisible) setSelectedLocation([log]); }}
                >
                  <View
                    pointerEvents={pointerEvents as any}
                    style={{ backgroundColor: info.color }}
                    className="w-9 h-9 rounded-full items-center justify-center shadow border-2 border-card"
                  >
                    <DrinkIcon type={log.drink_type as DrinkType} size={20} color="white" />
                  </View>
                </Marker>
              );
            }

            // Cluster: multiple drinks at this location
            return (
              <Marker
                key={`cluster-${lat}-${lng}-${isMine ? 'mine' : 'friend'}`}
                coordinate={{ latitude: lat, longitude: lng }}
                opacity={opacity}
                calloutEnabled={false}
                onPress={() => { if (isVisible) setSelectedLocation(items); }}
              >
                <View className="items-center justify-center" pointerEvents={pointerEvents as any}>
                  <View className="w-11 h-11 rounded-full bg-primary items-center justify-center shadow border-2 border-card">
                    {/* Drinks by quantity: a log of 2 counts 2. */}
                    <Text className="text-primary-foreground font-bold text-sm">{items.reduce((sum, i) => sum + Number(i.quantity), 0)}</Text>
                  </View>
                </View>
              </Marker>
            );
        })}
      </MapView>

      {/* Location bottom sheet */}
      {selectedLocation && (
        <MapLocationSheet
          items={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onViewSession={(id) => {
            setSelectedLocation(null);
            router.push(`/session/${id}`);
          }}
          onViewDrink={(id) => {
            setSelectedLocation(null);
            router.push(`/drink/${id}`);
          }}
        />
      )}

      {/* Loading overlay — keeps MapView mounted so position is preserved */}
      {showLoading && (
        <View className="absolute inset-0 items-center justify-center bg-black/10">
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      )}

      {/* Error overlay */}
      {showError && (
        <View className="absolute inset-0 items-center justify-center">
          <View className="bg-card rounded-2xl px-8 py-6 mx-8 items-center shadow-lg border border-border">
            <Text className="text-3xl mb-2">⚠️</Text>
            <Text className="text-foreground font-semibold text-center">Could not load drinks</Text>
            <Text className="text-muted-foreground text-sm text-center mt-1">
              {(logsError as Error)?.message ?? 'Something went wrong.'}
            </Text>
          </View>
        </View>
      )}

      {/* Empty overlay */}
      {!showLoading && !showError && !logs?.length && (
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

const styles = StyleSheet.create({
  filterContainer: {
    position: 'absolute',
    ...Platform.select({
      web: {
        top: 16,
        left: 60, // Avoid overlapping Leaflet zoom controls on the left on Web
        right: 16,
      },
      default: {
        top: 56, // top-14 equivalent for status bar clearance on mobile
        left: 16,
        right: 16,
      },
    }),
    zIndex: 1000,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
