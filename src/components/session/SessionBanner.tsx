import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveSession, useEndSession, useLeaveSession, useSessionDrinks } from "@/hooks/useSession";
import { useSessionMembers } from "@/hooks/useSessionMembers";
import { usePrefsStore } from "@/stores/prefsStore";
import { useAuthStore } from "@/stores/authStore";
import { calculateBAC, ProfileInput, DrinkInput } from "@/utils/bacHelpers";
import { formatDuration } from "@/utils/dateHelpers";
import { DrinkLog } from "@/types/models";
import { Avatar } from "@/components/common/Avatar";
import { FollowerPickerModal } from "@/components/session/FollowerPickerModal";
import { useSessionInvites } from "@/hooks/useSessionMembers";

export function SessionBanner() {
  const { top } = useSafeAreaInsets();
  const activeSession = useActiveSession();
  const { user } = useAuthStore();
  const { mutateAsync: endSession, isPending: isEnding } = useEndSession();
  const { mutateAsync: leaveSession, isPending: isLeaving } = useLeaveSession();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const isHost = activeSession?.my_role === "host";
  const isPending = isEnding || isLeaving;

  const { sex, weight, weightUnit } = usePrefsStore();
  const { data: sessionDrinks } = useSessionDrinks(activeSession?.id);
  const { data: members } = useSessionMembers(activeSession?.id);
  const { data: existingInvites } = useSessionInvites(isHost ? activeSession?.id : undefined);

  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    if (!activeSession) return;
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, [activeSession?.id]);

  async function handleEndOrLeave() {
    if (!activeSession || !user?.id) return;
    if (!confirmEnd) {
      setConfirmEnd(true);
      setTimeout(() => setConfirmEnd(false), 3000);
      return;
    }
    if (isHost) {
      await endSession(activeSession.id);
    } else {
      await leaveSession({ sessionId: activeSession.id, userId: user.id });
    }
    setConfirmEnd(false);
  }

  const duration = useMemo(() => {
    if (!activeSession) return "";
    return formatDuration(activeSession.started_at, currentTime.toISOString());
  }, [activeSession?.started_at, currentTime]);

  // BAC is personal — only current user's drinks
  const drinkInputs = useMemo<DrinkInput[]>(() => {
    if (!sessionDrinks) return [];
    return (sessionDrinks as DrinkLog[])
      .filter((d) => d.user_id === user?.id)
      .map((d) => ({
        quantity: d.quantity,
        loggedAt: d.logged_at,
        endedAt: d.ended_at,
      }));
  }, [sessionDrinks, user?.id]);

  const liveBAC = useMemo(() => {
    if (!activeSession) return 0;
    const profileInput: ProfileInput = { weight, weightUnit, sex };
    return calculateBAC(profileInput, drinkInputs, currentTime);
  }, [activeSession, weight, weightUnit, sex, drinkInputs, currentTime]);

  if (!activeSession) return null;

  const bannerBgColor =
    liveBAC >= 0.08 ? "bg-red-600" : liveBAC > 0.0 ? "bg-amber-500" : "bg-emerald-600";
  const drivingStatusIcon = liveBAC >= 0.08 ? "🚫" : liveBAC > 0.0 ? "⚠️" : "✅";
  const drivingStatusText =
    liveBAC >= 0.08
      ? "Impaired (Do Not Drive)"
      : liveBAC > 0.0
        ? "Caution (Under 0.08%)"
        : "Safe to Drive";

  // Other members (exclude self)
  const otherMembers = (members ?? []).filter((m) => m.user_id !== user?.id);
  const visibleMembers = otherMembers.slice(0, 3);
  const overflowCount = otherMembers.length > 3 ? otherMembers.length - 3 : 0;

  return (
    <>
      <View
        className={`${bannerBgColor} px-4 py-2.5`}
        style={{ paddingTop: top + 4, zIndex: 1 }}
      >
        {/* Row 1: session info + controls */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-3 justify-center">
            <View className="flex-row items-center gap-1.5 flex-wrap">
              <View className="w-1.5 h-1.5 rounded-full bg-white opacity-90" />
              <Text className="text-white font-bold text-sm" numberOfLines={1}>
                {activeSession.title ?? "Night Out"}
              </Text>
              <Text className="text-white/80 text-xs font-semibold">
                · {duration}
              </Text>
            </View>

            <View className="flex-row items-center gap-2 mt-1 flex-wrap">
              <View className="bg-white/20 px-2 py-0.5 rounded-full">
                <Text className="text-white text-[11px] font-bold">
                  BAC: {liveBAC.toFixed(3)}%
                </Text>
              </View>
              <Text className="text-white text-[11px] font-semibold">
                {drivingStatusIcon} {drivingStatusText}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {/* Invite button (host only) */}
            {isHost && (
              <Pressable
                onPress={() => setShowInviteModal(true)}
                className="bg-white/20 active:bg-white/30 rounded-full p-1.5"
              >
                <Ionicons name="person-add-outline" size={16} color="#fff" />
              </Pressable>
            )}

            {/* End / Leave button */}
            <Pressable
              onPress={handleEndOrLeave}
              disabled={isPending}
              className="bg-white/20 active:bg-white/30 rounded-full px-3.5 py-1.5 flex-row items-center gap-1 self-center"
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={isHost ? "stop-circle-outline" : "exit-outline"}
                    size={14}
                    color="#fff"
                  />
                  <Text className="text-white text-xs font-bold">
                    {confirmEnd ? "Tap again" : isHost ? "End" : "Leave"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* Row 2: member avatars (only when there are co-members) */}
        {otherMembers.length > 0 && (
          <View className="flex-row items-center gap-1.5 mt-1.5">
            <Text className="text-white/70 text-[11px]">With</Text>
            {visibleMembers.map((m, i) => (
              <View
                key={m.user_id}
                style={{ marginLeft: i > 0 ? -6 : 0 }}
                className="border border-white/40 rounded-full"
              >
                <Avatar
                  uri={m.avatar_url}
                  name={m.display_name ?? m.username}
                  size={22}
                />
              </View>
            ))}
            {overflowCount > 0 && (
              <View className="bg-white/20 rounded-full px-1.5 py-0.5">
                <Text className="text-white text-[10px] font-bold">+{overflowCount}</Text>
              </View>
            )}
            {visibleMembers.map((m) => (
              <Text key={`name-${m.user_id}`} className="text-white/80 text-[11px]" numberOfLines={1}>
                {m.display_name ?? m.username}
              </Text>
            )).slice(0, 2)}
          </View>
        )}
      </View>

      {isHost && (
        <FollowerPickerModal
          visible={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          sessionId={activeSession.id}
          currentInvites={existingInvites ?? []}
          currentMembers={members ?? []}
        />
      )}
    </>
  );
}
