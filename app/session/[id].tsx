import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColorScheme } from "nativewind";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/common/Avatar";
import { ImageCarousel } from "@/components/common/ImageCarousel";
import { DrinkIcon } from "@/components/icons/DrinkIcon";
import { useAddComment, useComments, useDeleteComment } from "@/hooks/useComments";
import { supabase } from "@/lib/supabase";
import { DRINK_TYPE_MAP } from "@/lib/constants";
import { useAuthStore } from "@/stores/authStore";
import { DrinkComment, DrinkLog, DrinkType, Profile, Session } from "@/types/models";
import { formatDate, formatDateTime, formatDuration, formatTime, relativeTime } from "@/utils/dateHelpers";
import { getDisplayName, getUsername } from "@/utils/profileHelpers";

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [commentText, setCommentText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sessionDetail", id],
    queryFn: async () => {
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", id!)
        .single();
      if (sessionError) throw sessionError;

      const { data: drinks, error: drinksError } = await supabase
        .from("drink_logs")
        .select("*")
        .eq("session_id", id!)
        .order("logged_at", { ascending: true });
      if (drinksError) throw drinksError;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", (session as Session).user_id)
        .single();
      if (profileError) throw profileError;

      return {
        session: session as Session,
        drinks: (drinks ?? []) as DrinkLog[],
        profile: profile as Profile,
      };
    },
    enabled: !!id,
  });

  const representativeDrinkId = data?.drinks[0]?.id;
  const { data: comments, isLoading: commentsLoading } = useComments(representativeDrinkId);
  const addComment = useAddComment(user?.id);
  const deleteComment = useDeleteComment(user?.id);

  async function handleSendComment() {
    const trimmed = commentText.trim();
    if (!trimmed || !user || !representativeDrinkId) return;
    setCommentText("");
    await addComment.mutateAsync({ drinkLogId: representativeDrinkId, content: trimmed });
  }

  if (isLoading || !data) {
    return (
      <SafeAreaView className={`flex-1 bg-background items-center justify-center ${isDark ? "dark" : ""}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  const { session, drinks, profile } = data;
  const totalQuantity = drinks.reduce((s, d) => s + d.quantity, 0);
  const locations = [...new Set(drinks.map((d) => d.location_name).filter(Boolean))] as string[];
  const drinkTypes = [...new Set(drinks.map((d) => d.drink_type))];
  const photos = drinks.map((d) => d.photo_url).filter(Boolean) as string[];
  const duration = formatDuration(session.started_at, session.ended_at ?? undefined);
  const hoursElapsed =
    ((session.ended_at ? new Date(session.ended_at) : new Date()).getTime() -
      new Date(session.started_at).getTime()) /
    (1000 * 60 * 60);
  const drinksPerHour =
    hoursElapsed >= 0.25 && totalQuantity > 0 ? (totalQuantity / hoursElapsed).toFixed(1) : "—";
  const isActive = !session.ended_at;

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
      {/* Nav bar */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2">
          <Ionicons name="close" size={24} color="orange" />
        </Pressable>
        <Text className="font-bold text-foreground text-base">Night Out</Text>
        <View className="w-10" />
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          {/* Photos carousel */}
          {photos.length > 0 && (
            <ImageCarousel images={photos} height={220} borderRadius={16} />
          )}

          {/* Title + time */}
          <View className="mt-4 mb-4">
            <View className="flex-row items-center gap-2 mb-1">
              {isActive && (
                <View className="flex-row items-center gap-1.5">
                  <View className="w-2 h-2 rounded-full bg-primary" />
                  <Text className="text-primary text-xs font-semibold">In progress</Text>
                </View>
              )}
            </View>
            <Text className="text-2xl font-bold text-foreground mb-1">
              {session.title ?? "Night Out"}
            </Text>
            <Text className="text-muted-foreground text-sm">
              {formatDate(session.started_at)}
              {" · "}
              {formatTime(session.started_at)}
              {session.ended_at ? ` – ${formatTime(session.ended_at)}` : " · ongoing"}
            </Text>
          </View>

          {/* Stats */}
          <View className="bg-card rounded-2xl p-4 mb-4">
            <View className="flex-row justify-around">
              <View className="items-center">
                <Text className="text-xl font-bold text-primary">{totalQuantity}</Text>
                <Text className="text-xs text-muted-foreground">drinks</Text>
              </View>
              <View className="items-center">
                <Text className="text-xl font-bold text-primary">{drinks.length}</Text>
                <Text className="text-xs text-muted-foreground">rounds</Text>
              </View>
              <View className="items-center">
                <Text className="text-xl font-bold text-primary">{duration}</Text>
                <Text className="text-xs text-muted-foreground">duration</Text>
              </View>
              <View className="items-center">
                <Text className="text-xl font-bold text-primary">{drinksPerHour}</Text>
                <Text className="text-xs text-muted-foreground">per hour</Text>
              </View>
              {locations.length > 0 && (
                <View className="items-center">
                  <Text className="text-xl font-bold text-primary">{locations.length}</Text>
                  <Text className="text-xs text-muted-foreground">{locations.length === 1 ? "spot" : "spots"}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Drink types */}
          <View className="flex-row gap-2 flex-wrap mb-4">
            {drinkTypes.map((type) => {
              const info = DRINK_TYPE_MAP[type as DrinkType] ?? DRINK_TYPE_MAP["other"];
              const count = drinks.filter((d) => d.drink_type === type).length;
              return (
                <View key={type} className="flex-row items-center bg-accent rounded-full px-3 py-1.5 gap-1.5">
                  <DrinkIcon type={type as DrinkType} size={18} color={info.color} />
                  <Text className="text-sm text-muted-foreground font-medium">
                    {info.label} ×{count}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Locations */}
          {locations.length > 0 && (
            <View className="flex-row items-center gap-1.5 mb-4">
              <Ionicons name="location-outline" size={14} color="gray" />
              <Text className="text-muted-foreground text-sm">{locations.join(" → ")}</Text>
            </View>
          )}

          {/* Drinks list */}
          <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-3">
            Drinks ({drinks.length})
          </Text>
          <View className="bg-card rounded-2xl p-4 gap-3 mb-4">
            {drinks.map((drink) => {
              const info = DRINK_TYPE_MAP[drink.drink_type as DrinkType] ?? DRINK_TYPE_MAP["other"];
              return (
                <Pressable
                  key={drink.id}
                  className="flex-row items-center gap-3"
                  onPress={() => router.push(`/drink/${drink.id}`)}
                >
                  <View
                    style={{ backgroundColor: info.color + "15" }}
                    className="w-10 h-10 rounded-xl items-center justify-center"
                  >
                    <DrinkIcon type={drink.drink_type as DrinkType} size={22} color={info.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground text-sm font-medium">
                      {drink.drink_name || drink.event_name || info.label}
                      {drink.quantity !== 1 && (
                        <Text className="text-muted-foreground font-normal"> ×{drink.quantity}</Text>
                      )}
                      {drink.brand ? (
                        <Text className="text-muted-foreground font-normal"> · {drink.brand}</Text>
                      ) : null}
                    </Text>
                    {drink.location_name ? (
                      <Text className="text-muted-foreground text-xs">{drink.location_name}</Text>
                    ) : null}
                    <Text className="text-muted-foreground text-xs">{formatDateTime(drink.logged_at)}</Text>
                  </View>
                  {drink.photo_url ? (
                    <View className="w-10 h-10 rounded-lg overflow-hidden">
                      <Ionicons name="image-outline" size={16} color="gray" />
                    </View>
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color="hsl(var(--muted-foreground))" />
                </Pressable>
              );
            })}
          </View>

          {/* Author */}
          <Pressable
            className="flex-row items-center p-3 bg-card rounded-2xl mb-6"
            onPress={() => router.push(`/user/${profile.id}`)}
          >
            <Avatar uri={profile.avatar_url} name={profile.display_name ?? profile.username} size={38} />
            <View className="ml-3 flex-1">
              <Text className="font-semibold text-foreground">
                {profile.display_name ?? profile.username}
              </Text>
              <Text className="text-muted-foreground text-xs">@{profile.username}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="hsl(var(--muted-foreground))" />
          </Pressable>

          {/* Comments */}
          {representativeDrinkId && (
            <View>
              <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-3">
                Comments {comments && comments.length > 0 ? `(${comments.length})` : ""}
              </Text>

              {commentsLoading ? (
                <ActivityIndicator color="#f59e0b" />
              ) : comments && comments.length > 0 ? (
                <View className="gap-4">
                  {comments.map((comment) => (
                    <CommentRow
                      key={comment.id}
                      comment={comment}
                      isOwn={comment.user_id === user?.id}
                      onDelete={() =>
                        deleteComment.mutate({ commentId: comment.id, drinkLogId: representativeDrinkId })
                      }
                      isDeleting={
                        deleteComment.isPending &&
                        (deleteComment.variables as { commentId: string } | undefined)?.commentId === comment.id
                      }
                      onNavigate={(userId) => router.push(`/user/${userId}`)}
                    />
                  ))}
                </View>
              ) : (
                <Text className="text-muted-foreground text-sm">No comments yet.</Text>
              )}

              {user && (
                <View className="flex-row items-end gap-2 mt-4">
                  <TextInput
                    ref={inputRef}
                    value={commentText}
                    onChangeText={setCommentText}
                    placeholder="Add a comment…"
                    placeholderTextColor="gray"
                    multiline
                    maxLength={500}
                    className="flex-1 bg-card border border-border rounded-2xl px-4 py-2.5 text-foreground text-sm max-h-24"
                    style={{ lineHeight: 20 }}
                  />
                  <Pressable
                    onPress={handleSendComment}
                    disabled={!commentText.trim() || addComment.isPending}
                    className="w-9 h-9 items-center justify-center rounded-full bg-primary disabled:opacity-40"
                  >
                    {addComment.isPending ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="send" size={16} color="white" />
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface CommentRowProps {
  comment: DrinkComment;
  isOwn: boolean;
  onDelete: () => void;
  isDeleting: boolean;
  onNavigate: (userId: string) => void;
}

function CommentRow({ comment, isOwn, onDelete, isDeleting, onNavigate }: CommentRowProps) {
  const profile = comment.profile;
  return (
    <View className="flex-row gap-3">
      <Pressable onPress={() => onNavigate(comment.user_id)}>
        <Avatar uri={profile?.avatar_url} name={getDisplayName(profile)} size={32} />
      </Pressable>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5 flex-wrap">
          <Pressable onPress={() => onNavigate(comment.user_id)}>
            <Text className="text-foreground font-semibold text-sm">{getDisplayName(profile)}</Text>
          </Pressable>
          <Text className="text-muted-foreground text-xs">@{getUsername(profile)}</Text>
          <Text className="text-muted-foreground text-xs">· {relativeTime(comment.created_at)}</Text>
        </View>
        <Text className="text-foreground text-sm mt-0.5 leading-5">{comment.content}</Text>
      </View>
      {isOwn && (
        <Pressable onPress={onDelete} disabled={isDeleting} hitSlop={8} className="pt-0.5">
          {isDeleting ? (
            <ActivityIndicator size="small" color="gray" />
          ) : (
            <Ionicons name="trash-outline" size={15} color="gray" />
          )}
        </Pressable>
      )}
    </View>
  );
}
