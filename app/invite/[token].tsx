import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { Avatar } from "@/components/common/Avatar";
import { PublicInvitePreview } from "@/components/invite/PublicInvitePreview";
import { JoinSessionView } from "@/components/session/JoinSessionView";
import { PublicLayout } from "@/components/web/PublicLayout";
import { useMakeRoomToJoin } from "@/hooks/useSessionInvite";
import {
  pendingInvites,
  useAcceptShareInvite,
  useJoinViaShareLink,
  useSharePreview,
  useShareInviteLink,
} from "@/hooks/useShareLinks";
import {
  formatDrinkTotal,
  inviteUrl,
  isSharePreviewError,
  isValidShareToken,
  personName,
  SharePreview,
  shareCopy,
} from "@/lib/shareLinks";
import { useAuthStore } from "@/stores/authStore";

// Generic tags for the static export. Link-preview crawlers get per-link ones
// from api/share-preview.ts (see vercel.json).
const STATIC_TITLE = "You're invited to Suds";
const STATIC_DESCRIPTION = "Join your friends on Suds, the social drink tracker.";

const ERROR_TEXT: Record<string, { title: string; body: string }> = {
  revoked: { title: "This link was turned off", body: "Whoever shared it stopped sharing it. Ask them for a new one." },
  expired: { title: "This link has expired", body: "Night-out links stop working a day after the night ends." },
  not_found: { title: "Link not found", body: "Check the link, or ask whoever shared it to send it again." },
  own_link: { title: "That's your own link", body: "Share it with friends so they can join you." },
  hosting_active_session: { title: "You're hosting a night out", body: "End your night out before joining another." },
  session_ended: { title: "This night out has ended", body: "You can still follow them on Suds." },
};

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session: authSession, user, isLoading: authLoading } = useAuthStore();
  const signedIn = !!authSession;
  const validToken = isValidShareToken(token) ? token : undefined;
  const { data, isLoading, error } = useSharePreview(validToken, user?.id);

  // The static web export renders this once with no real token; show the
  // spinner there (and on the first client render, so hydration matches)
  // rather than "Link not found" until the page loads.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isStaticRender = !mounted;
  const preview = data && !isSharePreviewError(data) ? data : null;
  const errorKey = isStaticRender
    ? null
    : !validToken
      ? "not_found"
      : isSharePreviewError(data)
        ? data.error
        : error
          ? "not_found"
          : null;
  const copy = preview ? shareCopy(preview) : null;

  // Signed in now: this invite is being handled, so sign-up won't reopen it.
  useEffect(() => {
    if (signedIn && validToken && pendingInvites.peek()?.token === validToken) void pendingInvites.clear();
  }, [signedIn, validToken]);

  const head = (
    <Head>
      <title>{copy ? `${copy.title} | Suds` : `${STATIC_TITLE} | Suds`}</title>
      <meta name="description" content={copy?.description ?? STATIC_DESCRIPTION} />
      <meta name="robots" content="noindex" />
      <meta property="og:title" content={copy?.title ?? STATIC_TITLE} />
      <meta property="og:description" content={copy?.description ?? STATIC_DESCRIPTION} />
      <meta property="og:type" content="website" />
      {mounted && validToken && <meta property="og:url" content={inviteUrl(validToken)} />}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={copy?.title ?? STATIC_TITLE} />
      <meta name="twitter:description" content={copy?.description ?? STATIC_DESCRIPTION} />
      {mounted && validToken && <meta name="apple-itunes-app" content={`app-id=6761397970, app-argument=${inviteUrl(validToken)}`} />}
    </Head>
  );

  // Signed out (or auth still loading on web, where this page is public).
  if (!signedIn) {
    return (
      <>
        {head}
        <SignedOutInvite token={validToken} preview={preview} errorKey={errorKey} loading={isStaticRender || isLoading || (authLoading && Platform.OS !== "web")} />
      </>
    );
  }

  return (
    <>
      {head}
      <SignedInInvite token={validToken} preview={preview} errorKey={errorKey} loading={isLoading} />
    </>
  );
}

// ── Signed out ───────────────────────────────────────────────

function SignedOutInvite({
  token,
  preview,
  errorKey,
  loading,
}: {
  token: string | undefined;
  preview: SharePreview | null;
  errorKey: string | null;
  loading: boolean;
}) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  // Light-only on web, like the rest of the public site (PublicLayout).
  const isDark = Platform.OS !== "web" && colorScheme === "dark";

  async function go(to: "/(auth)/sign-up" | "/(auth)/sign-in") {
    if (token && preview) await pendingInvites.save(token, shareCopy(preview).cta);
    router.push(to as never);
  }

  let body: React.ReactNode;
  if (loading && !preview) {
    body = (
      <View style={{ paddingVertical: 96, alignItems: "center" }}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  } else if (preview && token) {
    body = (
      <PublicInvitePreview
        token={token}
        preview={preview}
        onSignUp={() => go("/(auth)/sign-up")}
        onSignIn={() => go("/(auth)/sign-in")}
      />
    );
  } else {
    body = (
      <InviteError
        errorKey={errorKey ?? "not_found"}
        isDark={isDark}
        action={{ label: "Learn about Suds", onPress: () => router.replace(Platform.OS === "web" ? "/" : ("/(auth)/sign-up" as never)) }}
      />
    );
  }

  if (Platform.OS === "web") return <PublicLayout>{body}</PublicLayout>;
  return (
    <SafeAreaView className={`flex-1 ${isDark ? "bg-gray-950" : "bg-white"}`}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>{body}</ScrollView>
    </SafeAreaView>
  );
}

// ── Signed in ────────────────────────────────────────────────

function SignedInInvite({
  token,
  preview,
  errorKey,
  loading,
}: {
  token: string | undefined;
  preview: SharePreview | null;
  errorKey: string | null;
  loading: boolean;
}) {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuthStore();
  const { activeSession, prepare, isLeaving } = useMakeRoomToJoin();
  const join = useJoinViaShareLink(user?.id);
  const accept = useAcceptShareInvite(user?.id);
  const share = useShareInviteLink();
  const [failure, setFailure] = useState<string | null>(null);

  const done = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/feed"));

  // Already in this night out: just open it.
  const isMember = !!preview?.viewer?.is_member && !!preview.session;
  useEffect(() => {
    if (isMember && preview?.session) router.replace(`/session/${preview.session.id}` as never);
  }, [isMember]);

  if (loading || isMember) {
    return (
      <SafeAreaView className={`flex-1 items-center justify-center bg-background ${isDark ? "dark" : ""}`}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </SafeAreaView>
    );
  }

  if (!preview || !token || failure) {
    const key = failure ?? errorKey ?? "not_found";
    return (
      <SafeAreaView className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
        <InviteError errorKey={key} isDark={isDark} action={{ label: "Go to feed", onPress: () => router.replace("/(tabs)/feed") }} />
      </SafeAreaView>
    );
  }

  const inviterName = personName(preview.inviter);
  const viewer = preview.viewer;

  // Your own link: offer to share it again.
  if (viewer?.is_inviter) {
    return (
      <SafeAreaView className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
        <InviteError
          errorKey="own_link"
          isDark={isDark}
          action={{
            label: "Share it",
            onPress: () =>
              share.mutate({
                kind: preview.kind,
                sessionId: preview.session?.id,
                sessionTitle: preview.session?.title,
              }),
          }}
        />
      </SafeAreaView>
    );
  }

  const followNote = preview.inviter.is_private
    ? `Joining also sends ${inviterName} a follow request.`
    : `Joining also follows ${inviterName}.`;

  // A night out you can join: the same screen as a direct invite.
  if (preview.kind === "session" && preview.can_join && preview.session) {
    const s = preview.session;
    async function handleJoin() {
      if (!token || !(await prepare())) return;
      try {
        const joined = await join.mutateAsync({ token, inviterId: preview!.inviter.id });
        router.replace(`/session/${joined.id}` as never);
      } catch (err) {
        const key = err instanceof Error ? err.message : "";
        if (ERROR_TEXT[key]) setFailure(key);
        else Alert.alert("Could not join", "Something went wrong. Try again.");
      }
    }
    return (
      <JoinSessionView
        inviterName={inviterName}
        inviterAvatarUrl={preview.inviter.avatar_url}
        subtitle="to join their night out"
        sessionTitle={s.title}
        startedAt={s.started_at}
        members={s.members}
        activeSession={activeSession}
        note={viewer?.follow_status === "following" ? undefined : followNote}
        primaryLabel="Join Night Out"
        onPrimary={handleJoin}
        secondaryLabel="Not now"
        onSecondary={done}
        isWorking={join.isPending || isLeaving}
      />
    );
  }

  // A personal invite, or a night out that's over: follow them.
  const status = viewer?.follow_status ?? "none";
  const followed = status === "following" || status === "requested" || accept.isSuccess;
  const resultStatus = accept.data?.follow_status ?? status;

  async function handleFollow() {
    if (!token) return;
    try {
      await accept.mutateAsync({ token });
    } catch (err) {
      const key = err instanceof Error ? err.message : "";
      if (ERROR_TEXT[key]) setFailure(key);
      else Alert.alert("Couldn't follow", "Something went wrong. Try again.");
    }
  }

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6">
        <View className="items-center pt-12 pb-6 gap-3">
          <Avatar uri={preview.inviter.avatar_url} name={inviterName} size={80} />
          <Text className="text-foreground text-xl font-bold text-center">
            {preview.session ? `${inviterName}'s night out has ended` : `${inviterName} invited you to Suds`}
          </Text>
          <Text className="text-muted-foreground text-sm text-center">@{preview.inviter.username}</Text>
          {preview.session && (
            <Text className="text-muted-foreground text-sm text-center">
              {preview.session.title?.trim() || "Night Out"} · {formatDrinkTotal(preview.session.drink_total)}
            </Text>
          )}
        </View>

        <View className="gap-3 pb-8">
          {followed ? (
            <>
              <View className="flex-row items-center justify-center gap-2 py-2">
                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                <Text className="text-foreground font-semibold">
                  {resultStatus === "requested" ? `Follow request sent to ${inviterName}` : `You follow ${inviterName}`}
                </Text>
              </View>
              <Pressable
                onPress={() => router.replace(`/user/${preview.inviter.id}` as never)}
                className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
              >
                <Text className="text-white font-bold text-base">See {inviterName}'s profile</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={handleFollow}
              disabled={accept.isPending}
              className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
            >
              {accept.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">
                  {preview.inviter.is_private ? `Request to follow ${inviterName}` : `Follow ${inviterName}`}
                </Text>
              )}
            </Pressable>
          )}
          <Pressable
            onPress={() => router.replace("/(tabs)/feed")}
            className="bg-card border border-border rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-foreground font-semibold text-base">Go to feed</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Shared ───────────────────────────────────────────────────

function InviteError({
  errorKey,
  isDark,
  action,
}: {
  errorKey: string;
  isDark: boolean;
  action: { label: string; onPress: () => void };
}) {
  const text = ERROR_TEXT[errorKey] ?? ERROR_TEXT.not_found;
  return (
    <View className="flex-1 items-center justify-center gap-4" style={{ paddingHorizontal: 32, paddingVertical: 96 }}>
      <Ionicons name="link-outline" size={56} color={isDark ? "#9ca3af" : "#6b7280"} />
      <Text className={`text-xl font-bold text-center ${isDark ? "text-white" : "text-gray-900"}`}>{text.title}</Text>
      <Text className={`text-center text-base ${isDark ? "text-gray-400" : "text-gray-500"}`} style={{ maxWidth: 360 }}>
        {text.body}
      </Text>
      <Pressable onPress={action.onPress} className="mt-2 bg-primary rounded-full px-6 py-3" accessibilityRole="button">
        <Text className="text-white font-bold">{action.label}</Text>
      </Pressable>
    </View>
  );
}
