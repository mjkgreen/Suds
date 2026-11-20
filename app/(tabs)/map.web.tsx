import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { buildMapClusters, fetchMapLogs, fetchSessionRoutes, groupMapLocation, isMyNightOut, MapLog } from '@/lib/mapData';
import { getDisplayName, getUsername } from '@/utils/profileHelpers';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { DrinkType } from '@/types/models';
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
/**
 * What a pin's popup lists: one clickable row per night out (opens it) or
 * per drink logged on its own (opens the drink). Same entries as the app's
 * MapLocationSheet.
 */
function MapPopupList({ items, onOpen }: { items: MapLog[]; onOpen: (path: string) => void }) {
  const entries = groupMapLocation(
    items,
    (type) => (DRINK_TYPE_MAP[type as DrinkType] ?? DRINK_TYPE_MAP['other']).label,
    getDisplayName,
    getUsername,
  );
  const total = Math.round(items.reduce((sum, i) => sum + Number(i.quantity), 0) * 10) / 10;

  return (
    <div style={{ minWidth: 220, maxWidth: 280, fontFamily: 'system-ui, sans-serif' }}>
      {items.length > 1 && (
        <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', margin: '0 0 6px' }}>{total} drinks at this spot</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
        {entries.map((entry) => {
          const path = entry.sessionId ? `/session/${entry.sessionId}` : `/drink/${entry.items[0].id}`;
          return (
            <button
              key={entry.sessionId ?? entry.items[0].id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(path);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                background: '#f3f4f6', border: 0, borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
              }}
              aria-label={entry.sessionId ? `View night out ${entry.title}` : `View drink ${entry.title}`}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entry.sessionId ? '🌙 ' : ''}{entry.title}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '3px 0' }}>
                  {Object.entries(entry.typeCounts).map(([type, count]) => {
                    const info = DRINK_TYPE_MAP[type as DrinkType] ?? DRINK_TYPE_MAP['other'];
                    return (
                      <span key={type} style={{ fontSize: 11, fontWeight: 600, color: info.color, background: info.color + '22', borderRadius: 999, padding: '1px 6px' }}>
                        {info.label} ×{count}
                      </span>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {[entry.who, formatDateTime(entry.loggedAt), entry.locationName].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span style={{ color: '#9ca3af', fontSize: 18, lineHeight: 1 }}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

  const filteredSessions = React.useMemo(() => {
    if (!sessionsWithRoutes) return [];
    return sessionsWithRoutes.filter((session) => {
      const isMine = isMyNightOut(session, user?.id);
      return filter === 'mine' ? isMine : !isMine;
    });
  }, [sessionsWithRoutes, filter, user?.id]);

  const center: [number, number] = React.useMemo(() => {
    if (!logs?.length) return [37.78825, -122.4324];
    const avgLat = logs.reduce((s, l) => s + (l.location_lat ?? 0), 0) / logs.length;
    const avgLng = logs.reduce((s, l) => s + (l.location_lng ?? 0), 0) / logs.length;
    return [avgLat, avgLng];
  }, [logs]);

  // Nearby drinks grouped into My Drinks / Friends pins (src/lib/mapData.ts)
  const clusters = React.useMemo(() => buildMapClusters(logs, user?.id), [logs, user?.id]);

  const filteredClusters = React.useMemo(() => {
    return clusters.filter((c) => {
      return filter === 'mine' ? c.isMine : !c.isMine;
    });
  }, [clusters, filter]);

  // Pins are what the map is for: show them as soon as they're here (or
  // saved from last time) instead of waiting on the slower routes query.
  // Routes just appear when they arrive, and a routes failure isn't worth
  // covering the pins with an error.
  const showLoading = isLoading;
  const showError = !showLoading && !!logsError && !logs;

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
                <L.Tooltip sticky>{session.title || 'Night Out'}</L.Tooltip>
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
                    <MapPopupList items={items} onOpen={(path) => router.push(path as any)} />
                  </L.Popup>
                </L.Marker>
              );
            }

            // Cluster: multiple drinks at this location (counted by quantity:
            // a log of 2 counts 2).
            const clusterCount = items.reduce((sum, i) => sum + Number(i.quantity), 0);
            const clusterIcon =
              typeof window !== 'undefined'
                ? (window as any).L?.divIcon({
                    html: `<div style="background:#f59e0b;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:white;border:2px solid currentColor;box-shadow:0 2px 6px rgba(0,0,0,0.35)">${clusterCount}</div>`,
                    className: 'border-card',
                    iconSize: [44, 44],
                    iconAnchor: [22, 22],
                    })
                : undefined;

            return (
              <L.Marker key={`cluster-${lat}-${lng}`} position={[lat, lng]} icon={clusterIcon}>
                <L.Popup>
                  <MapPopupList items={items} onOpen={(path) => router.push(path as any)} />
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
            <Text className="text-foreground font-semibold text-center">Could not load drinks</Text>
            <Text className="text-muted-foreground text-sm text-center mt-1">
              {(logsError as Error)?.message ?? 'Something went wrong.'}
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
