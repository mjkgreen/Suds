import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/common/Avatar";
import { DrinkIcon } from "@/components/icons/DrinkIcon";
import { FollowButton } from "@/components/social/FollowButton";
import { useBlockedIds } from "@/hooks/useBlocks";
import { useDebounce } from "@/hooks/useDebounce";
import {
  DrinkResult,
  MIN_SEARCH_LENGTH,
  PlaceResult,
  useDrinkSearch,
  usePlaceSearch,
  usePopularPlaces,
} from "@/hooks/usePlaceDrinkSearch";
import { useActiveSession } from "@/hooks/useSession";
import { useSuggestedUsers } from "@/hooks/useSuggestedUsers";
import { DRINK_TYPE_MAP, SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { normalizeLabel } from "@/lib/drinkSearch";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Profile } from "@/types/models";
import { formatDistanceToNowStrict, parseISO } from "date-fns";

/** People shown before "Show all". */
const PEOPLE_PREVIEW = 5;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function countsLine(r: { drink_count: number; people_count: number; last_logged_at: string }) {
  const people = r.people_count === 1 ? "1 person" : `${r.people_count} people`;
  return `${plural(r.drink_count, "drink")} · ${people} · ${formatDistanceToNowStrict(parseISO(r.last_logged_at), { addSuffix: true })}`;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="px-6 pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </Text>
  );
}

const UserRow = React.memo(function UserRow({ profile, currentUserId }: { profile: Profile; currentUserId: string }) {
  const router = useRouter();

  return (
    <Pressable
      className="flex-row items-center px-6 py-4 border-b border-border active:bg-accent"
      onPress={() => router.push(`/user/${profile.id}`)}
    >
      <Avatar uri={profile.avatar_url} name={profile.display_name ?? profile.username} size={46} />
      <View className="flex-1 ml-3">
        <Text className="font-semibold text-foreground">{profile.display_name ?? profile.username}</Text>
        <Text className="text-muted-foreground text-sm">@{profile.username}</Text>
      </View>
      <FollowButton targetProfile={profile} currentUserId={currentUserId} size="sm" />
    </Pressable>
  );
});

function PlaceRow({ place }: { place: PlaceResult }) {
  const router = useRouter();
  return (
    <Pressable
      className="flex-row items-center px-6 py-3.5 border-b border-border active:bg-accent"
      onPress={() => router.push({ pathname: "/browse", params: { place: place.place_name } } as never)}
    >
      <View className="w-11 h-11 rounded-full bg-accent items-center justify-center">
        <Ionicons name="location" size={20} color="#f59e0b" />
      </View>
      <View className="flex-1 ml-3">
        <Text className="font-semibold text-foreground" numberOfLines={1}>
          {place.place_name}
        </Text>
        <Text className="text-muted-foreground text-sm" numberOfLines={1}>
          {countsLine(place)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </Pressable>
  );
}

function DrinkRow({ drink }: { drink: DrinkResult }) {
  const router = useRouter();
  const info = DRINK_TYPE_MAP[drink.drink_type] ?? DRINK_TYPE_MAP.other;
  return (
    <Pressable
      className="flex-row items-center px-6 py-3.5 border-b border-border active:bg-accent"
      onPress={() =>
        router.push({ pathname: "/browse", params: { label: drink.label, kind: drink.kind } } as never)
      }
    >
      <View
        className="w-11 h-11 rounded-full items-center justify-center"
        style={{ backgroundColor: `${info.color}22` }}
      >
        <DrinkIcon type={drink.drink_type} size={20} color={info.color} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="font-semibold text-foreground" numberOfLines={1}>
          {drink.label}
        </Text>
        <Text className="text-muted-foreground text-sm" numberOfLines={1}>
          {drink.kind === "brand" ? "Brand" : info.label} · {countsLine(drink)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </Pressable>
  );
}

/** Characters that would break PostgREST's or() filter syntax. */
function sanitizePeopleQuery(q: string) {
  return q.replace(/[,()%*\\]/g, " ").trim();
}

export default function SearchScreen() {
  const { user } = useAuthStore();
  const currentUserId = user?.id ?? "";
  const activeSession = useActiveSession();
  const topEdges = activeSession ? [] : ["top" as const];
  const [query, setQuery] = useState("");
  const [showAllPeople, setShowAllPeople] = useState(false);
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const peopleQuery = sanitizePeopleQuery(debouncedQuery);
  const searching = normalizeLabel(debouncedQuery).length >= MIN_SEARCH_LENGTH;

  const { data: people, isLoading: peopleLoading } = useQuery({
    queryKey: ["searchUsers", peopleQuery],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.%${peopleQuery}%,display_name.ilike.%${peopleQuery}%`)
        .limit(20);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: searching && peopleQuery.length >= MIN_SEARCH_LENGTH,
  });
  const { data: places, isLoading: placesLoading } = usePlaceSearch(debouncedQuery);
  const { data: drinks, isLoading: drinksLoading } = useDrinkSearch(debouncedQuery);

  const { data: suggested } = useSuggestedUsers(user?.id);
  const { data: popularPlaces } = usePopularPlaces(user?.id);

  const { data: blockedIds } = useBlockedIds(user?.id);
  const notBlocked = (p: Profile) => !(blockedIds ?? []).includes(p.id);
  const visiblePeople = (people ?? []).filter(notBlocked);
  const shownPeople = showAllPeople ? visiblePeople : visiblePeople.slice(0, PEOPLE_PREVIEW);
  const visibleSuggested = (suggested ?? []).filter(notBlocked);

  const anyLoading = searching && (peopleLoading || placesLoading || drinksLoading);
  const noResults =
    searching && !anyLoading && visiblePeople.length === 0 && !places?.length && !drinks?.length;

  const onChangeQuery = (text: string) => {
    setQuery(text);
    setShowAllPeople(false);
  };

  return (
    <>
      <Head>
        <title>Search | Suds</title>
      </Head>
      <SafeAreaView className="flex-1 bg-background" edges={topEdges}>
        {/* Search bar */}
        <View className="px-4 pt-6 pb-3 bg-card border-b border-border">
          <Text className="text-2xl font-bold text-foreground mb-3">Search</Text>
          <View className="flex-row items-center bg-accent rounded-xl px-4 py-2.5">
            <Ionicons name="search" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
            <TextInput
              className="flex-1 text-base text-foreground"
              placeholder="People, places, drinks"
              placeholderTextColor="#9ca3af"
              value={query}
              onChangeText={onChangeQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => onChangeQuery("")} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 32 }}>
          {searching ? (
            <>
              {shownPeople.length > 0 && (
                <>
                  <SectionHeader title="People" />
                  {shownPeople.map((p) => (
                    <UserRow key={p.id} profile={p} currentUserId={currentUserId} />
                  ))}
                  {!showAllPeople && visiblePeople.length > PEOPLE_PREVIEW && (
                    <Pressable className="px-6 py-3 active:bg-accent" onPress={() => setShowAllPeople(true)}>
                      <Text className="text-primary font-semibold">Show all {visiblePeople.length} people</Text>
                    </Pressable>
                  )}
                </>
              )}

              {!!places?.length && (
                <>
                  <SectionHeader title="Places" />
                  {places.map((p) => (
                    <PlaceRow key={p.place_name} place={p} />
                  ))}
                </>
              )}

              {!!drinks?.length && (
                <>
                  <SectionHeader title="Drinks" />
                  {drinks.map((d) => (
                    <DrinkRow key={`${d.kind}:${d.label}`} drink={d} />
                  ))}
                </>
              )}

              {anyLoading && (
                <View className="py-8 items-center">
                  <ActivityIndicator color="#f59e0b" />
                </View>
              )}

              {noResults && (
                <View className="py-16 items-center px-8">
                  <Text className="text-muted-foreground text-base text-center">
                    Nothing found for "{debouncedQuery.trim()}"
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              {visibleSuggested.length > 0 && (
                <>
                  <SectionHeader title="Suggested people" />
                  {visibleSuggested.map((p) => (
                    <UserRow key={p.id} profile={p} currentUserId={currentUserId} />
                  ))}
                </>
              )}

              {!!popularPlaces?.length && (
                <>
                  <SectionHeader title="Popular with your friends" />
                  {popularPlaces.map((p) => (
                    <PlaceRow key={p.place_name} place={p} />
                  ))}
                </>
              )}

              {visibleSuggested.length === 0 && !popularPlaces?.length && (
                <View className="py-16 items-center px-8">
                  <Text className="text-muted-foreground font-semibold text-lg text-center">
                    Find your drinking crew
                  </Text>
                  <Text className="text-muted-foreground/60 text-sm text-center mt-2">
                    Search for friends, the bars you go to, or the drinks you like.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
