import { Ionicons } from '@expo/vector-icons';
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

interface LocationResult {
  lat: number;
  lng: number;
  name: string;
}

interface LocationPickerProps {
  value: string;
  onChange: (name: string, lat?: number, lng?: number) => void;
  onClear?: () => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

async function searchPlaces(query: string): Promise<NominatimResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) return [];
  return res.json();
}

export function LocationPicker({ value, onChange, onClear }: LocationPickerProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const debouncedQuery = useDebounce(query, 400);
  const { getCurrentLocation, isLoading: isGettingGPS } = useLocation();
  const suppressSearch = useRef(false);

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
    if (debouncedQuery.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSearching(true);
    searchPlaces(debouncedQuery)
      .then((results) => {
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      })
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  function handleSelect(result: NominatimResult) {
    const name = result.display_name.split(',').slice(0, 2).join(', ');
    suppressSearch.current = true;
    setQuery(name);
    setShowSuggestions(false);
    onChange(name, parseFloat(result.lat), parseFloat(result.lon));
  }

  async function handleGPS() {
    const result = await getCurrentLocation();
    if (result) {
      const name = result.name ?? `${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`;
      suppressSearch.current = true;
      setQuery(name);
      setShowSuggestions(false);
      onChange(name, result.lat, result.lng);
    }
  }

  return (
    <View>
      <View className="flex-row gap-2">
        <View className="flex-1 relative">
          <TextInput
            className="bg-card border border-border rounded-xl px-4 py-3 pr-10 text-base text-foreground"
            placeholder="Search a venue or address…"
            placeholderTextColor="hsl(var(--muted-foreground))"
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              onChange(t, undefined, undefined);
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
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
                  setShowSuggestions(false);
                  onChange('', undefined, undefined);
                  onClear?.();
                }}
                hitSlop={8}
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
        >
          {isGettingGPS ? (
            <ActivityIndicator size="small" color="#f59e0b" />
          ) : (
            <Ionicons name="locate-outline" size={22} color="#f59e0b" />
          )}
        </Pressable>
      </View>

      {showSuggestions && (
        <View
          className="bg-card border border-border rounded-xl mt-1 overflow-hidden"
          style={{ maxHeight: 220 }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {suggestions.map((r) => {
              const parts = r.display_name.split(', ');
              const primary = parts.slice(0, 2).join(', ');
              const secondary = parts.slice(2, 4).join(', ');
              return (
                <Pressable
                  key={r.place_id}
                  className="px-4 py-3 border-b border-border/50 active:bg-accent"
                  onPress={() => handleSelect(r)}
                >
                  <Text className="text-foreground text-sm font-medium" numberOfLines={1}>
                    {primary}
                  </Text>
                  {secondary ? (
                    <Text className="text-muted-foreground text-xs mt-0.5" numberOfLines={1}>
                      {secondary}
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
