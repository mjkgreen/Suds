import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { useColorScheme } from "nativewind";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { supabase } from "@/lib/supabase";
import { useSessionMembers } from "@/hooks/useSessionMembers";
import { SessionRecapCard } from "@/components/share/SessionRecapCard";
import { DrinkLog, Session } from "@/types/models";
import { WEB_BASE_URL } from "@/lib/links";
import { AnalyticsEvents, track } from "@/lib/analytics";

interface SessionRecapModalProps {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
}

// Post-night share moment: shown right after a session ends (peak delight)
// and reachable from any ended session. Renders the 9:16 recap card and
// pushes it into the native share sheet as an image.
export function SessionRecapModal({ visible, onClose, sessionId }: SessionRecapModalProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (visible) track(AnalyticsEvents.RecapOpened, { session_id: sessionId });
  }, [visible, sessionId]);

  const { data } = useQuery({
    queryKey: ["sessionRecap", sessionId],
    queryFn: async () => {
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (sessionError) throw sessionError;
      const { data: drinks, error: drinksError } = await supabase
        .from("drink_logs")
        .select("*")
        .eq("session_id", sessionId)
        .order("logged_at", { ascending: true });
      if (drinksError) throw drinksError;
      return { session: session as Session, drinks: (drinks ?? []) as DrinkLog[] };
    },
    enabled: visible && !!sessionId,
  });
  const { data: members } = useSessionMembers(visible ? sessionId : undefined);

  const session = data?.session;
  const locations = [
    ...new Set((data?.drinks ?? []).map((d) => d.location_name).filter(Boolean)),
  ] as string[];

  async function handleShare() {
    track(AnalyticsEvents.RecapShared, { session_id: sessionId });
    // Web can't capture the card as an image — share the site link instead
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator
          .share({ text: `Great night out, tracked on Suds 🍻 ${WEB_BASE_URL}` })
          .catch(() => {});
      }
      return;
    }
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
        // 3x pixel ratio → ~1080x1920, Instagram-story ready
        result: "tmpfile",
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share your night",
        });
      } else {
        await Share.share({ url: uri, message: `Great night out, tracked on Suds 🍻` });
      }
    } catch {
      // User cancelled or capture failed — nothing to clean up
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Text className="text-foreground font-semibold text-base">That's a Wrap 🍻</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={isDark ? "#9ca3af" : "#6b7280"} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ alignItems: "center", padding: 24 }}>
          {!session || !members ? (
            <View className="py-24">
              <ActivityIndicator size="large" color="#f59e0b" />
            </View>
          ) : (
            <>
              {/* collapsable=false so view-shot can snapshot this subtree on Android */}
              <View ref={cardRef} collapsable={false}>
                <SessionRecapCard
                  title={session.title}
                  startedAt={session.started_at}
                  endedAt={session.ended_at ?? new Date().toISOString()}
                  members={members}
                  locations={locations}
                />
              </View>

              <Text className="text-muted-foreground text-sm text-center mt-5 px-8">
                Post it to your story — every share brings the crew closer.
              </Text>

              <View className="w-full gap-3 mt-5">
                <Pressable
                  onPress={handleShare}
                  disabled={sharing}
                  className="bg-primary rounded-2xl py-4 flex-row items-center justify-center gap-2 active:opacity-80"
                >
                  {sharing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="share-outline" size={18} color="#fff" />
                      <Text className="text-white font-bold text-base">Share Your Night</Text>
                    </>
                  )}
                </Pressable>
                <Pressable onPress={onClose} className="py-3 items-center">
                  <Text className="text-muted-foreground font-semibold text-sm">Not now</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
