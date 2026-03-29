import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { DRINK_TYPE_MAP } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { DrinkLog, DrinkType } from '@/types/models';
import { formatDateTime } from '@/utils/dateHelpers';

type MapFilter = 'mine' | 'friends' | 'all';

// Dynamically loaded react-leaflet components
type LeafletComponents = typeof import('react-leaflet');

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
  const [filter, setFilter] = useState<MapFilter>('all');
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
    import('react-leaflet').then(setL);
  }, []);

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

  const center: [number, number] = React.useMemo(() => {
    if (!logs?.length) return [37.78825, -122.4324];
    const avgLat = logs.reduce((s, l) => s + (l.location_lat ?? 0), 0) / logs.length;
    const avgLng = logs.reduce((s, l) => s + (l.location_lng ?? 0), 0) / logs.length;
    return [avgLat, avgLng];
  }, [logs]);

  return (
    <SafeAreaView className="flex-1 bg-gray-900" edges={['top']}>
      {/* Tap hint */}
      <View className="absolute bottom-6 left-0 right-0 items-center" style={{ zIndex: 1000, pointerEvents: 'none' }}>
        <View className="bg-black/60 rounded-full px-4 py-2">
          <Text className="text-white text-xs">Tap anywhere on the map to log a drink</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View className="absolute top-14 left-4 right-4 z-10 flex-row gap-2" style={{ zIndex: 1000 }}>
        {(['all', 'mine', 'friends'] as MapFilter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            className={`px-4 py-2 rounded-full shadow ${filter === f ? 'bg-amber-500' : 'bg-white'}`}
          >
            <Text className={`font-semibold text-sm capitalize ${filter === f ? 'text-white' : 'text-gray-700'}`}>
              {f === 'all' ? 'Everyone' : f === 'mine' ? 'My Drinks' : 'Friends'}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading || !L ? (
        <View className="flex-1 items-center justify-center bg-gray-100">
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
          <MapClickHandler onMapClick={handleMapClick} />
          {(logs ?? []).map((log) => {
            if (!log.location_lat || !log.location_lng) return null;
            const info = DRINK_TYPE_MAP[log.drink_type as DrinkType] ?? DRINK_TYPE_MAP['other'];
            const divIcon =
              typeof window !== 'undefined'
                ? (window as any).L?.divIcon({
                    html: `<div style="background:${info.color};width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">${info.emoji}</div>`,
                    className: '',
                    iconSize: [36, 36],
                    iconAnchor: [18, 18],
                  })
                : undefined;
            return (
              <L.Marker
                key={log.id}
                position={[log.location_lat, log.location_lng]}
                icon={divIcon}
              >
                <L.Popup>
                  <View style={{ minWidth: 160 }}>
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
                </L.Popup>
              </L.Marker>
            );
          })}
        </L.MapContainer>
      )}

      {!isLoading && !logs?.length && (
        <View className="absolute inset-0 items-center justify-center" style={{ zIndex: 999 }}>
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
