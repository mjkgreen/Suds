import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { DrinkCard } from "@/components/drink/DrinkCard";
import { DrinkMatch, useMatchingDrinks } from "@/hooks/usePlaceDrinkSearch";
import { useAuthStore } from "@/stores/authStore";
import { FeedItem } from "@/types/models";

/**
 * Recent drinks at one place (?place=…) or with one brand / drink name
 * (?label=…&kind=brand|name), opened from a search result.
 */
export default function BrowseScreen() {
  const params = useLocalSearchParams<{ place?: string; label?: string; kind?: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuthStore();

  const match = useMemo<DrinkMatch | null>(() => {
    if (params.place) return { place: params.place };
    if (params.label && (params.kind === "brand" || params.kind === "name")) {
      return { label: params.label, kind: params.kind };
    }
    return null;
  }, [params.place, params.label, params.kind]);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMatchingDrinks(match);
  const items = useMemo(() => data?.pages.flat() ?? [], [data]);

  const title = params.place ?? params.label ?? "Drinks";
  const subtitle = params.place ? "Place" : params.kind === "brand" ? "Brand" : "Drink";

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => <DrinkCard item={item} currentUserId={user?.id} />,
    [user?.id],
  );

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
      <Head>
        <title>{`${title} | Suds`}</title>
      </Head>
      <View className="flex-row items-center px-4 py-3 bg-background border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 mr-2" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color="orange" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xs text-muted-foreground">{subtitle}</Text>
          <Text className="font-bold text-foreground text-base" numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-6 items-center">
                <ActivityIndicator color="#f59e0b" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="py-16 items-center px-8">
              <Text className="text-muted-foreground text-base text-center">
                {isError ? "Couldn't load these drinks." : "No drinks you can see here yet."}
              </Text>
              {isError && (
                <Pressable onPress={() => refetch()} className="mt-4">
                  <Text className="text-primary font-semibold">Try again</Text>
                </Pressable>
              )}
            </View>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </SafeAreaView>
  );
}
