import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Share,
  Text,
  View,
} from "react-native";
import { useColorScheme } from "nativewind";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { useSessionShareLink } from "@/hooks/useOpenInvite";
import { useSessionInvites } from "@/hooks/useSessionMembers";
import { FollowerPickerModal } from "@/components/session/FollowerPickerModal";
import { useAuthStore } from "@/stores/authStore";
import { SessionMember } from "@/types/models";
import { buildJoinUrl, buildInviteMessage } from "@/lib/links";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { getDisplayName } from "@/utils/profileHelpers";

interface InviteShareModalProps {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  isHost: boolean;
  currentMembers: SessionMember[];
}

// The growth surface for a live session: anyone in the night can share an
// open link (SMS/WhatsApp/anything) or show a QR for in-person joins —
// no account needed on the other end. Hosts can additionally invite
// followers in-app.
export function InviteShareModal({
  visible,
  onClose,
  sessionId,
  isHost,
  currentMembers,
}: InviteShareModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { profile } = useAuthStore();
  const [showFollowerPicker, setShowFollowerPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: link, isLoading, isError } = useSessionShareLink(sessionId, visible);
  const { data: existingInvites } = useSessionInvites(isHost && visible ? sessionId : undefined);

  const joinUrl = link ? buildJoinUrl(link.token) : null;
  const inviterName = (profile && getDisplayName(profile)) || "Your friend";

  async function handleShare() {
    if (!joinUrl) return;
    track(AnalyticsEvents.InviteShared, { method: "share_sheet", session_id: sessionId });
    const message = buildInviteMessage(inviterName, joinUrl);
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text: message, url: joinUrl }).catch(() => {});
      } else {
        await handleCopy();
      }
      return;
    }
    await Share.share(
      Platform.OS === "ios" ? { message, url: joinUrl } : { message }
    ).catch(() => {});
  }

  async function handleCopy() {
    if (!joinUrl) return;
    track(AnalyticsEvents.InviteShared, { method: "copy_link", session_id: sessionId });
    await Clipboard.setStringAsync(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
            <Text className="text-foreground font-semibold text-base">Invite to the Night Out</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={isDark ? "#9ca3af" : "#6b7280"} />
            </Pressable>
          </View>

          <View className="flex-1 px-6 pt-6 items-center">
            {/* QR code — scan to join, works for people without the app */}
            <View className="bg-white rounded-3xl p-5 items-center">
              {isLoading || !joinUrl ? (
                <View className="w-[200px] h-[200px] items-center justify-center">
                  {isError ? (
                    <Text className="text-muted-foreground text-sm text-center px-4">
                      Couldn't create an invite link. Try again.
                    </Text>
                  ) : (
                    <ActivityIndicator color="#f59e0b" />
                  )}
                </View>
              ) : (
                <QRCode value={joinUrl} size={200} backgroundColor="#ffffff" color="#111827" />
              )}
            </View>
            <Text className="text-muted-foreground text-sm text-center mt-4 px-6">
              Friends scan this to join — even if they don't have Suds yet.
            </Text>

            {/* Share actions */}
            <View className="w-full gap-3 mt-8">
              <Pressable
                onPress={handleShare}
                disabled={!joinUrl}
                className="bg-primary rounded-2xl py-4 flex-row items-center justify-center gap-2 active:opacity-80 disabled:opacity-40"
              >
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text className="text-white font-bold text-base">Share Invite Link</Text>
              </Pressable>

              <Pressable
                onPress={handleCopy}
                disabled={!joinUrl}
                className="bg-card border border-border rounded-2xl py-4 flex-row items-center justify-center gap-2 active:opacity-80 disabled:opacity-40"
              >
                <Ionicons
                  name={copied ? "checkmark-outline" : "copy-outline"}
                  size={18}
                  color={copied ? "#10b981" : isDark ? "#e5e7eb" : "#111827"}
                />
                <Text className={`font-semibold text-base ${copied ? "text-emerald-500" : "text-foreground"}`}>
                  {copied ? "Copied!" : "Copy Link"}
                </Text>
              </Pressable>

              {isHost && (
                <Pressable
                  onPress={() => setShowFollowerPicker(true)}
                  className="rounded-2xl py-4 flex-row items-center justify-center gap-2 active:opacity-70"
                >
                  <Ionicons name="people-outline" size={18} color="#f59e0b" />
                  <Text className="text-primary font-semibold text-base">
                    Invite people you follow
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {isHost && (
        <FollowerPickerModal
          visible={showFollowerPicker}
          onClose={() => setShowFollowerPicker(false)}
          sessionId={sessionId}
          currentInvites={existingInvites ?? []}
          currentMembers={currentMembers}
        />
      )}
    </>
  );
}
