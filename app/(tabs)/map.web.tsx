import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { Coordinate, DrinkLog, DrinkType, Session, SessionWithLogs, DrinkLogWithSessionAndProfile } from '@/types/models';
import { formatDateTime } from '@/utils/dateHelpers';

type MapFilter = 'mine' | 'friends';

// Dynamically loaded react-leaflet components
type LeafletComponents = typeof import('react-leaflet');

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

// Centers the map on the user's current GPS position on mount
function MapLocationCenterer({ useMap }: { useMap: any }) {
  const map = useMap();
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 14, { animate: true, duration: 0.5 });
      },
      () => {},
    );
  }, [map]);
  return null;
}

// Inner component that uses react-leaflet hooks (must be inside MapContainer)
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  // Loaded dynamically — access via window.ReactLeaflet set below
  const [useMapEvents, setUseMapEvents] = useState<any>(null);
  useEffect(() => {
    import('react-leaflet').then((L) => setUseMapEvents(() => L.useMapEvents));
  }, []);

  if (!useMapEvents) return null;
  return <MapClickHandlerInner onMapClick={onMapClick} useMapEvents={useMapEvents} />;
}

function MapClickHandlerInner({
  onMapClick,
  useMapEvents,
}: {
  onMapClick: (lat: number, lng: number) => void;
  useMapEvents: any;
}) {
  useMapEvents({ click: (e: any) => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function MapScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [filter, setFilter] = useState<MapFilter>('mine');
  const [showRoutes, setShowRoutes] = useState(true);
  const [L, setL] = useState<LeafletComponents | null>(null);

  async function handleMapClick(lat: number, lng: number) {
    const name = await reverseGeocode(lat, lng);
    router.push({
      pathname: '/(tabs)/log',
      params: { lat: String(lat), lng: String(lng), name: encodeURIComponent(name) },
    });
  }

  // Inject Leaflet CSS + dynamically import react-leaflet (avoids SSR crash)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('mci-css')) {
      const link = document.createElement('link');
      link.id = 'mci-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/@mdi/font@7.2.96/css/materialdesignicons.min.css';
      document.head.appendChild(link);
    }
    import('react-leaflet').then(setL);
  }, []);

  const { data: logs, isLoading, error: logsError } = useQuery({
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
        .select('*, profile:profiles!drink_logs_user_id_fkey(id, username, display_name, avatar_url), session:sessions(id, title, started_at, ended_at, created_at, user_id)')
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null)
        .in('user_id', allIds)
        .order('logged_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      return data as DrinkLogWithSessionAndProfile[];
    },
    enabled: !!user,
  });

  const { data: sessionsWithRoutes, isLoading: sessionsLoading, error: sessionsError } = useQuery({
    queryKey: ['sessionRoutes', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      const ids = (follows as { following_id: string }[] | null ?? []).map((f) => f.following_id);
      const allIds = [user.id, ...ids];

      // Single database query fetching sessions along with their coordinates, joining the sessions table with drink_logs
      const { data: sessionsData, error: sError } = await supabase
        .from('sessions')
        .select('*, logs:drink_logs(*)')
        .in('user_id', allIds)
        .order('started_at', { ascending: false });

      if (sError) throw sError;
      if (!sessionsData || sessionsData.length === 0) return [];

      const results: SessionWithLogs[] = sessionsData.map((session: any) => {
        // Filter out logs that don't have coordinates and sort them chronologically
        const sessionLogs = (session.logs as DrinkLog[] ?? [])
          .filter((log) => log.location_lat !== null && log.location_lng !== null)
          .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());

        const route: Coordinate[] = sessionLogs.map((log, index) => ({
          latitude: log.location_lat!,
          longitude: log.location_lng!,
          timestamp: log.logged_at,
          sequence_order: index + 1,
          session_id: session.id,
          location_name: log.location_name,
          drink_log_id: log.id,
        }));

        return {
          id: session.id,
          user_id: session.user_id,
          title: session.title,
          started_at: session.started_at,
          ended_at: session.ended_at,
          created_at: session.created_at,
          logs: sessionLogs,
          route,
        };
      });

      return results;
    },
    enabled: !!user,
  });

  const filteredSessions = React.useMemo(() => {
    if (!sessionsWithRoutes) return [];
    return sessionsWithRoutes.filter((session) => {
      const isMine = session.user_id === user?.id;
      return filter === 'mine' ? isMine : !isMine;
    });
  }, [sessionsWithRoutes, filter, user?.id]);

  const center: [number, number] = React.useMemo(() => {
    if (!logs?.length) return [37.78825, -122.4324];
    const avgLat = logs.reduce((s, l) => s + (l.location_lat ?? 0), 0) / logs.length;
    const avgLng = logs.reduce((s, l) => s + (l.location_lng ?? 0), 0) / logs.length;
    return [avgLat, avgLng];
  }, [logs]);

  // Group nearby logs into clusters (~100m radius via 3-decimal rounding)
  const clusters = React.useMemo(() => {
    const groups = new Map<string, { items: DrinkLogWithSessionAndProfile[]; isMine: boolean }>();
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

  const filteredClusters = React.useMemo(() => {
    return clusters.filter((c) => {
      return filter === 'mine' ? c.isMine : !c.isMine;
    });
  }, [clusters, filter]);

  const showLoading = isLoading || sessionsLoading;
  const showError = !showLoading && (logsError || sessionsError);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Tap hint */}
      <View className="absolute bottom-6 left-0 right-0 items-center" style={{ zIndex: 1000, pointerEvents: 'none' }}>
        <View className="bg-card/60 rounded-full px-4 py-2 border border-border/20">
          <Text className="text-foreground text-xs">Tap anywhere on the map to log a drink</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterContainer}>
        <View className="flex-row gap-2">
          {(['mine', 'friends'] as MapFilter[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              className={`px-4 py-2 rounded-full shadow-sm border border-border ${filter === f ? 'bg-primary' : 'bg-card'}`}
            >
              <Text className={`font-semibold text-sm ${filter === f ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                {f === 'mine' ? 'My Drinks' : 'Friends'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => setShowRoutes((prev) => !prev)}
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

      {!L ? (
        <View className="flex-1 items-center justify-center bg-background">
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : (
        <L.MapContainer
          center={center}
          zoom={12}
          style={{ flex: 1, width: '100%', height: '100%' }}
        >
          <L.TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapLocationCenterer useMap={L.useMap} />
          <MapClickHandler onMapClick={handleMapClick} />

          {/* Render Route Polylines */}
          {showRoutes && filteredSessions?.map((session) => {
            if (!session.route || session.route.length < 2) return null;
            const strokeColor = getPredictableColor(session.id);
            const dashArray = session.ended_at ? '5, 5' : undefined;

            return (
              <L.Polyline
                key={`polyline-${session.id}`}
                positions={session.route.map((coord) => [coord.latitude, coord.longitude])}
                color={strokeColor}
                weight={4}
                dashArray={dashArray}
                eventHandlers={{
                  click: () => {
                    router.push(`/session/${session.id}`);
                  }
                }}
              >
                <L.Popup>
                  <div className="min-w-[160px] p-1 font-sans">
                    <h3 className="font-bold text-sm text-gray-900 m-0 leading-tight">
                      {session.title || 'Drink Route'}
                    </h3>
                    <p className="text-blue-600 font-semibold text-xs mt-1 mb-1">
                      {session.ended_at ? 'Completed Session' : 'Active Session'}
                    </p>
                    <p className="text-gray-600 text-xs my-0.5">
                      🕒 Started: {formatDateTime(session.started_at)}
                    </p>
                    {session.ended_at && (
                      <p className="text-gray-600 text-xs my-0.5">
                        🏁 Ended: {formatDateTime(session.ended_at)}
                      </p>
                    )}
                    <p className="text-gray-400 text-[11px] mt-1 mb-2">
                      🍺 {session.route.length} stops logged
                    </p>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/session/${session.id}`);
                      }}
                      className="mt-2 w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs text-center py-1.5 px-3 rounded block transition-colors border-0 cursor-pointer"
                    >
                      View Session Detail
                    </button>
                  </div>
                </L.Popup>
              </L.Polyline>
            );
          })}

          {filteredClusters.map(({ lat, lng, items }) => {
            if (items.length === 1) {
              const log = items[0];
              const info = DRINK_TYPE_MAP[log.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
              const mciName =
                {
                  beer: 'beer',
                  wine: 'glass-wine',
                  cocktail: 'glass-cocktail',
                  spirit: 'liquor',
                  cider: 'bottle-wine',
                  seltzer: 'bottle-soda',
                }[log.drink_type as string] || 'help-circle-outline';

              const divIcon =
                typeof window !== 'undefined'
                  ? (window as any).L?.divIcon({
                      html: `<div style="background:${info.color};width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;border:2px solid currentColor;box-shadow:0 2px 4px rgba(0,0,0,0.3)"><span class="mdi mdi-${mciName}" style="font-size:20px; line-height: 1"></span></div>`,
                      className: 'border-card',
                      iconSize: [36, 36],
                      iconAnchor: [18, 18],
                    })
                  : undefined;
              return (
                <L.Marker key={log.id} position={[lat, lng]} icon={divIcon}>
                  <L.Popup>
                    <div className="min-w-[160px] p-1 font-sans">
                      <h3 className="font-bold text-sm text-gray-900 m-0">
                        {log.drink_name || info.label}
                      </h3>
                      <p className="text-gray-600 text-xs my-0.5 font-medium">
                        @{log.profile?.username}
                      </p>
                      {log.location_name && (
                        <p className="text-gray-600 text-xs my-0.5">
                          📍 {log.location_name}
                        </p>
                      )}
                      <p className="text-gray-400 text-[11px] mt-1 mb-2">
                        {formatDateTime(log.logged_at)}
                      </p>

                      {log.session_id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/session/${log.session_id}`);
                          }}
                          className="mt-2 w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs text-center py-1.5 px-3 rounded block transition-colors border-0 cursor-pointer"
                        >
                          View Session Detail
                        </button>
                      ) : (
                        <button
                          disabled
                          className="mt-2 w-full bg-gray-300 text-gray-500 font-semibold text-xs text-center py-1.5 px-3 rounded block border-0 cursor-not-allowed"
                        >
                          No Associated Session
                        </button>
                      )}
                    </div>
                  </L.Popup>
                </L.Marker>
              );
            }

            // Cluster: multiple drinks at this location
            const clusterIcon =
              typeof window !== 'undefined'
                ? (window as any).L?.divIcon({
                    html: `<div style="background:#f59e0b;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:white;border:2px solid currentColor;box-shadow:0 2px 6px rgba(0,0,0,0.35)">${items.length}</div>`,
                    className: 'border-card',
                    iconSize: [44, 44],
                    iconAnchor: [22, 22],
                    })
                : undefined;

            const sessionLog = items.find((item) => item.session_id);
            const clusterSessionId = sessionLog?.session_id;

            return (
              <L.Marker key={`cluster-${lat}-${lng}`} position={[lat, lng]} icon={clusterIcon}>
                <L.Popup>
                  <div className="min-w-[180px] p-1 font-sans">
                    <h3 className="font-bold text-sm text-gray-900 m-0 mb-1">
                      {items.length} drinks here
                    </h3>
                    {items.slice(0, 3).map((log) => {
                      const info = DRINK_TYPE_MAP[log.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
                      return (
                        <p key={log.id} className="text-gray-600 text-xs my-0.5 leading-tight">
                          • {log.drink_name || info.label} · @{log.profile?.username}
                        </p>
                      );
                    })}
                    {items.length > 3 && (
                      <p className="text-gray-400 text-[11px] mt-1 mb-2">
                        +{items.length - 3} more
                      </p>
                    )}

                    {clusterSessionId ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/session/${clusterSessionId}`);
                        }}
                        className="mt-2 w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs text-center py-1.5 px-3 rounded block transition-colors border-0 cursor-pointer"
                      >
                        View Session Detail
                      </button>
                    ) : (
                      <button
                        disabled
                        className="mt-2 w-full bg-gray-300 text-gray-500 font-semibold text-xs text-center py-1.5 px-3 rounded block border-0 cursor-not-allowed"
                      >
                        No Associated Session
                      </button>
                    )}
                  </div>
                </L.Popup>
              </L.Marker>
            );
          })}
        </L.MapContainer>
      )}

      {/* Loading overlay — keeps MapContainer mounted so position is preserved */}
      {showLoading && L && (
        <View className="absolute inset-0 items-center justify-center bg-black/10" style={{ zIndex: 999 }}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      )}

      {/* Error overlay */}
      {showError && (
        <View className="absolute inset-0 items-center justify-center" style={{ zIndex: 999 }}>
          <View className="bg-card rounded-2xl px-8 py-6 mx-8 items-center shadow-lg border border-border">
            <Text className="text-3xl mb-2">⚠️</Text>
            <Text className="text-foreground font-semibold text-center">Could not load drinks or routes</Text>
            <Text className="text-muted-foreground text-sm text-center mt-1">
              {((logsError || sessionsError) as Error)?.message ?? 'Something went wrong.'}
            </Text>
          </View>
        </View>
      )}

      {!isLoading && !logs?.length && (
        <View className="absolute inset-0 items-center justify-center" style={{ zIndex: 999 }}>
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
    top: 16,
    left: 60, // Avoid overlapping Leaflet zoom controls on the left on Web
    right: 16,
    zIndex: 1000,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
});
