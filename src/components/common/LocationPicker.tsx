import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDebounce } from '@/hooks/useDebounce';
import { useLocation } from '@/hooks/useLocation';
import { LatLng, nearbyPlaces, PlaceSuggestion, searchPlaces } from '@/lib/placeSearch';
import { usePrefsStore } from '@/stores/prefsStore';
import { placeToLocation, placeWillBeSanitized, resolveLocationName } from '@/utils/locationPrivacy';

interface LocationPickerProps {
  value: string;
  onChange: (name: string, lat?: number, lng?: number) => void;
  onClear?: () => void;
}

/** Last fixes older than this don't steer search results. */
const BIAS_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Where the person probably is, to rank nearby places first — without asking
 * for permission or waiting on a fresh GPS fix.
 */
async function lastKnownPosition(): Promise<LatLng | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getLastKnownPositionAsync({ maxAge: BIAS_MAX_AGE_MS });
    return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
  } catch {
    return null;
  }
}

function formatDistance(metres: number | undefined): string | null {
  if (metres === undefined || !Number.isFinite(metres)) return null;
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

export function LocationPicker({ value, onChange, onClear }: LocationPickerProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  /** "Nearby" venues from the last GPS fix, shown until the person types. */
  const [nearby, setNearby] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const { getCurrentLocation, isLoading: isGettingGPS } = useLocation();
  const { hideAddresses } = usePrefsStore();
  const suppressSearch = useRef(false);
  const bias = useRef<LatLng | null>(null);
  const searchId = useRef(0);

  useEffect(() => {
    void lastKnownPosition().then((pos) => {
      if (pos && !bias.current) bias.current = pos;
    });
  }, []);

  useEffect(() => {
    if (value !== query) {
      suppressSearch.current = true;
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    if (suppressSearch.current) {
      suppressSearch.current = false;
      return;
    }
    if (debouncedQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(nearby.length > 0 && debouncedQuery.length === 0);
      return;
    }
    // Only the latest query's results are shown, even if an older one lands later.
    const id = ++searchId.current;
    setSearching(true);
    searchPlaces(debouncedQuery, bias.current)
      .then((results) => {
        if (id !== searchId.current) return;
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      })
      .finally(() => {
        if (id === searchId.current) setSearching(false);
      });
  }, [debouncedQuery]);

  function handleSelect(place: PlaceSuggestion) {
    const { name, lat, lng } = placeToLocation(place, hideAddresses);
    suppressSearch.current = true;
    setQuery(name);
    setShowSuggestions(false);
    setNearby([]);
    onChange(name, lat, lng);
  }

  /**
   * Tapping into a location that was filled in automatically (the log screen
   * does that on open) offers the venues around you, in case GPS picked the
   * wrong one.
   */
  const nearbyRequested = useRef(false);
  function handleFocus() {
    if (list.length > 0) {
      setShowSuggestions(true);
      return;
    }
    if (nearbyRequested.current || !value) return;
    nearbyRequested.current = true;
    void (async () => {
      const at = bias.current ?? (await lastKnownPosition());
      if (!at) return;
      bias.current = at;
      const places = (await nearbyPlaces(at)).filter((p) => p.name !== value);
      setNearby(places);
      setShowSuggestions(places.length > 0);
    })();
  }

  async function handleGPS() {
    const result = await getCurrentLocation();
    if (!result) return;
    bias.current = { lat: result.lat, lng: result.lng };

    const { name, lat, lng } = resolveLocationName(result, hideAddresses);

    suppressSearch.current = true;
    setQuery(name);
    onChange(name, lat, lng);
    // GPS indoors is often off by a building: offer what's around to correct it.
    const others = result.nearby.filter((p) => p.name !== name);
    setNearby(others);
    setSuggestions([]);
    setShowSuggestions(others.length > 0);
  }

  const showingNearby = suggestions.length === 0 && nearby.length > 0;
  const list = showingNearby ? nearby : suggestions;

  return (
    <View>
      <View className="flex-row gap-2">
        <View className="flex-1 relative">
          <TextInput
            className="bg-card border border-border rounded-xl px-4 py-3 pr-10 text-base text-foreground"
            placeholder="Search a bar, restaurant, hotel…"
            placeholderTextColor="hsl(var(--muted-foreground))"
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              onChange(t, undefined, undefined);
            }}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            autoCorrect={false}
          />
          <View className="absolute right-3 top-3.5">
            {searching ? (
              <ActivityIndicator size="small" color="#f59e0b" />
            ) : query.length > 0 ? (
              <Pressable
                onPress={() => {
                  suppressSearch.current = true;
                  setQuery('');
                  setSuggestions([]);
                  setShowSuggestions(nearby.length > 0);
                  onChange('', undefined, undefined);
                  onClear?.();
                }}
                hitSlop={8}
                accessibilityLabel="Clear location"
              >
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <Pressable
          className="bg-card border border-border rounded-xl px-4 items-center justify-center"
          onPress={handleGPS}
          disabled={isGettingGPS}
          accessibilityLabel="Use my location"
        >
          {isGettingGPS ? (
            <ActivityIndicator size="small" color="#f59e0b" />
          ) : (
            <Ionicons name="locate-outline" size={22} color="#f59e0b" />
          )}
        </Pressable>
      </View>

      {showSuggestions && list.length > 0 && (
        <View
          className="bg-card border border-border rounded-xl mt-1 overflow-hidden"
          style={{ maxHeight: 260 }}
        >
          {showingNearby && (
            <Text className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider px-4 pt-2.5 pb-1">
              Not right? Places nearby
            </Text>
          )}
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {list.map((place) => {
              const distance = formatDistance(place.distance);
              return (
                <Pressable
                  key={place.id}
                  className="px-4 py-3 border-b border-border/50 active:bg-accent"
                  onPress={() => handleSelect(place)}
                >
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons
                      name={place.isVenue ? 'business-outline' : 'location-outline'}
                      size={14}
                      color="#9ca3af"
                    />
                    <Text className="text-foreground text-sm font-medium flex-1" numberOfLines={1}>
                      {place.name}
                    </Text>
                    {placeWillBeSanitized(place, hideAddresses) && (
                      <Ionicons name="shield-checkmark" size={13} color="#f59e0b" />
                    )}
                    {distance && <Text className="text-muted-foreground text-xs">{distance}</Text>}
                  </View>
                  {place.subtitle ? (
                    <Text className="text-muted-foreground text-xs mt-0.5 ml-5" numberOfLines={1}>
                      {place.subtitle}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
