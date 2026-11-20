import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import { useExistingShareLink, useRevokeShareLink, useShareInviteLink } from "@/hooks/useShareLinks";
import { ShareLinkKind } from "@/lib/shareLinks";

interface ShareInviteLinkSectionProps {
  kind: ShareLinkKind;
  sessionId?: string;
  sessionTitle?: string | null;
  /** Only query while visible. */
  enabled?: boolean;
}

const COPY: Record<ShareLinkKind, { title: string; off: string; on: string }> = {
  session: {
    title: "Invite anyone with a link",
    off: "Anyone with the link can see this night out (who's here and the drink total, never locations) and join until it ends.",
    on: "Link is on. Anyone with it can see this night out and join until it ends.",
  },
  profile: {
    title: "Invite friends to Suds",
    off: "Send a link to friends who aren't on Suds. When they join, they follow you.",
    on: "Anyone who signs up with your link follows you.",
  },
};

function confirm(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: action, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

/**
 * "Share invite link" for a night out (host only) or a personal invite.
 * Sharing makes the link; "Turn off" revokes it (the next share makes a new one).
 */
export function ShareInviteLinkSection({ kind, sessionId, sessionTitle, enabled = true }: ShareInviteLinkSectionProps) {
  const { data: link } = useExistingShareLink(kind, sessionId, enabled);
  const share = useShareInviteLink();
  const revoke = useRevokeShareLink();
  const copy = COPY[kind];

  async function handleRevoke() {
    if (!link) return;
    const ok = await confirm(
      "Turn off this link?",
      "People who open it will see that it's turned off. Anyone who already joined stays.",
      "Turn off",
    );
    if (ok) revoke.mutate({ token: link.token, kind, sessionId });
  }

  function handleShare() {
    share.mutate(
      { kind, sessionId, sessionTitle },
      { onError: () => Alert.alert("Couldn't share", "Something went wrong making the link. Try again.") },
    );
  }

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name="link-outline" size={18} color="#f59e0b" />
        <Text className="text-foreground font-semibold text-sm flex-1">{copy.title}</Text>
        {!!link && (
          <View className="bg-emerald-500/15 rounded-full px-2 py-0.5">
            <Text className="text-emerald-600 text-[11px] font-bold">ON</Text>
          </View>
        )}
      </View>
      <Text className="text-muted-foreground text-xs">{link ? copy.on : copy.off}</Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={handleShare}
          disabled={share.isPending}
          className="flex-1 flex-row items-center justify-center gap-1.5 bg-primary rounded-xl py-2.5 active:opacity-80"
          accessibilityRole="button"
        >
          {share.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="share-outline" size={15} color="#fff" />
              <Text className="text-white text-sm font-semibold">Share invite link</Text>
            </>
          )}
        </Pressable>
        {!!link && (
          <Pressable
            onPress={handleRevoke}
            disabled={revoke.isPending}
            className="flex-row items-center justify-center px-4 rounded-xl border border-border active:opacity-80"
            accessibilityRole="button"
          >
            <Text className="text-red-500 text-sm font-semibold">Turn off</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
