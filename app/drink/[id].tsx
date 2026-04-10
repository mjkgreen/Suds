import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useColorScheme } from "nativewind";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/common/Avatar";
import { ImageCarousel } from "@/components/common/ImageCarousel";
import { DrinkBadge } from "@/components/drink/DrinkBadge";
import { DrinkIcon } from "@/components/icons/DrinkIcon";
import { useDeleteDrinkLog } from "@/hooks/useDrinkLog";
import { useAddComment, useComments, useDeleteComment } from "@/hooks/useComments";
import { useLikers } from "@/hooks/useLikers";
import { AvatarStack } from "@/components/social/AvatarStack";
import { LikersModal } from "@/components/social/LikersModal";
import { supabase } from "@/lib/supabase";
import { DRINK_TYPE_MAP } from "@/lib/constants";
import { useAuthStore } from "@/stores/authStore";
import { DrinkComment, DrinkLog, DrinkType, Profile } from "@/types/models";
import { relativeTime, formatDateTime } from "@/utils/dateHelpers";
import { getDisplayName, getUsername } from "@/utils/profileHelpers";

export default function DrinkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { mutateAsync: deleteDrink } = useDeleteDrinkLog();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [commentText, setCommentText] = useState("");
  const [showLikers, setShowLikers] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const { data: comments, isLoading: commentsLoading } = useComments(id);
  const { data: likers } = useLikers(id);
  const addComment = useAddComment(user?.id);
  const deleteComment = useDeleteComment(user?.id);

  async function handleSendComment() {
    const trimmed = commentText.trim();
    if (!trimmed || !user || !id) return;
    setCommentText("");
    await addComment.mutateAsync({ drinkLogId: id, content: trimmed });
  }

  const { data, isLoading } = useQuery({
    queryKey: ["drinkDetail", id],
    queryFn: async () => {
      const { data: log, error: logError } = await supabase.from("drink_logs").select("*").eq("id", id!).single();
      if (logError) throw logError;

      const drinkLog = log as unknown as DrinkLog;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", drinkLog.user_id)
        .single();
      if (profileError) throw profileError;

      return { ...drinkLog, profile: profile as Profile };
    },
    enabled: !!id,
  });

  async function handleDelete() {
    if (!data || !user) return;
    Alert.alert("Delete Drink?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDrink({ id: data.id, userId: user.id });
          router.replace("/(tabs)/feed");
        },
      },
    ]);
  }

  if (isLoading || !data) {
    return (
      <SafeAreaView className={`flex-1 bg-background items-center justify-center ${isDark ? "dark" : ""}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }


  const info = DRINK_TYPE_MAP[data.drink_type as DrinkType] ?? DRINK_TYPE_MAP["other"];
  const isOwner = user?.id === data.user_id;

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
      {/* Nav bar */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2">
          <Ionicons name="close" size={24} color="orange" />
        </Pressable>
        <Text className="font-bold text-foreground text-base">Drink</Text>
        {isOwner ? (
          <View className="flex-row gap-1">
            <Pressable onPress={() => router.push(`/drink/edit/${data?.id}`)} className="p-2">
              <Ionicons name="pencil-outline" size={22} color="orange" />
            </Pressable>
            <Pressable onPress={handleDelete} className="p-2">
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </Pressable>
          </View>
        ) : (
          <View className="w-10" />
        )}
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {/* Photos */}
        {(() => {
          const photos = data.photo_urls?.length ? data.photo_urls : data.photo_url ? [data.photo_url] : [];
          return photos.length > 0 ? (
            <View style={{ marginBottom: 20 }}>
              <ImageCarousel images={photos} height={220} borderRadius={16} />
            </View>
          ) : null;
        })()}

        {/* Drink */}
        <View className="flex-row items-center mb-4">
          <View
            style={{ backgroundColor: info.color + "15" }}
            className="w-16 h-16 rounded-2xl items-center justify-center mr-4"
          >
            <DrinkIcon type={data.drink_type as DrinkType} size={36} color={info.color} />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">{data.event_name || info.label}</Text>
            {data.drink_name ? <Text className="text-foreground text-base mt-0.5">{data.drink_name}</Text> : null}
            {data.brand ? <Text className="text-muted-foreground text-lg mt-0.5">{data.brand}</Text> : null}
          </View>
          <View>
            {data.rating ? (
              <View className="flex-row items-center">
                <Text className="text-foreground font-bold">{data.rating}/10 </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Meta */}
        <View className="bg-card  rounded-2xl p-4 gap-3 mb-4">
          <View className="flex-row items-center">
            <View className="flex-row items-center">
              <Ionicons name="beaker-outline" size={18} color="hsl(var(--muted-foreground))" />
              <Text className="text-muted-foreground ml-2">
                <Text className="font-semibold text-foreground">{data.quantity}</Text> standard drink
                {data.quantity !== 1 ? "s" : ""}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={18} color="hsl(var(--muted-foreground))" />
              <Text className="text-muted-foreground ml-2">{formatDateTime(data.logged_at)}</Text>
            </View>
          </View>
          {data.location_name && (
            <View className="flex-row items-center">
              <Ionicons name="location-outline" size={18} color="hsl(var(--muted-foreground))" />
              <Text className="text-muted-foreground ml-2">{data.location_name}</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {data.notes && (
          <View className="mb-4">
            <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">Notes</Text>
            <Text className="text-foreground text-base">{data.notes}</Text>
          </View>
        )}

        {/* Author */}
        {data.profile && (
          <Pressable
            className="flex-row items-center mt-2 p-3 bg-card rounded-2xl"
            onPress={() => router.push(`/user/${data.profile?.id}`)}
          >
            <Avatar uri={data.profile.avatar_url} name={data.profile.display_name ?? data.profile.username} size={38} />
            <View className="ml-3">
              <Text className="font-semibold text-foreground">
                {data.profile.display_name ?? data.profile.username}
              </Text>
              <Text className="text-muted-foreground text-xs">@{data.profile.username}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="hsl(var(--muted-foreground))"
              style={{ marginLeft: "auto" }}
            />
          </Pressable>
        )}

        {/* Likers */}
        {likers && likers.length > 0 && (
          <View className="mt-6">
            <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-3">Liked by</Text>
            <AvatarStack
              profiles={likers}
              totalCount={likers.length}
              onPress={() => setShowLikers(true)}
              size={32}
              max={3}
            />
            <LikersModal
              drinkLogId={id!}
              visible={showLikers}
              onClose={() => setShowLikers(false)}
              currentUserId={user?.id}
            />
          </View>
        )}

        {/* Comments */}
        <View className="mt-6">
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
                  onDelete={() => deleteComment.mutate({ commentId: comment.id, drinkLogId: id! })}
                  isDeleting={deleteComment.isPending && (deleteComment.variables as any)?.commentId === comment.id}
                  onNavigate={(userId) => router.push(`/user/${userId}`)}
                />
              ))}
            </View>
          ) : (
            <Text className="text-muted-foreground text-sm">No comments yet.</Text>
          )}

          {/* Input */}
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
