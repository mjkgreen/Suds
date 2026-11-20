import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import { Avatar } from "@/components/common/Avatar";
import { AppStoreBadge, GooglePlayButton } from "@/components/web/AppStoreBadge";
import { formatDrinkTotal, personName, SharePreview, shareCopy } from "@/lib/shareLinks";
import { formatDuration } from "@/utils/dateHelpers";

interface PublicInvitePreviewProps {
  token: string;
  preview: SharePreview;
  /** Sign up, keeping the invite for after onboarding. */
  onSignUp: () => void;
  onSignIn: () => void;
}

const MAX_NAMED = 3;

/**
 * What someone without Suds sees when they open a share link: who invited
 * them, the night out (live or ended, the group's drink total, who's there)
 * and how to get in. Only the safe fields from get_share_preview (051).
 */
export function PublicInvitePreview({ token, preview, onSignUp, onSignIn }: PublicInvitePreviewProps) {
  const { colorScheme } = useColorScheme();
  const isWeb = Platform.OS === "web";
  // The public web pages (PublicLayout) are light-only; match them there.
  const isDark = !isWeb && colorScheme === "dark";
  const inviterName = personName(preview.inviter);
  const copy = shareCopy(preview);
  const session = preview.session;
  const live = !!session && !session.ended_at;
  const members = session?.members ?? [];
  const named = members.slice(0, MAX_NAMED).map(personName);
  const moreCount = members.length - named.length;

  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const card = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200";

  return (
    <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 32, gap: 20 }}>
      {/* Who invited you */}
      <View style={{ alignItems: "center", gap: 12 }}>
        <Avatar uri={preview.inviter.avatar_url} name={inviterName} size={80} />
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text className={`text-2xl font-bold text-center ${isDark ? "text-white" : "text-gray-900"}`}>
            {session ? `${inviterName} invited you` : `${inviterName} invited you to Suds`}
          </Text>
          <Text className={`text-base text-center ${muted}`}>
            {session
              ? preview.can_join
                ? "to join their night out"
                : "to follow their nights out"
              : "the social drink tracker: log drinks, follow friends, share your nights out"}
          </Text>
        </View>
      </View>

      {/* The night out */}
      {session && (
        <View className={`border rounded-2xl ${card}`} style={{ padding: 20, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}
              className={live ? "bg-emerald-500/15" : isDark ? "bg-gray-800" : "bg-gray-100"}
            >
              <View className={`w-2 h-2 rounded-full ${live ? "bg-emerald-500" : "bg-gray-400"}`} />
              <Text className={`text-xs font-bold ${live ? "text-emerald-600" : muted}`}>{live ? "LIVE" : "ENDED"}</Text>
            </View>
            <Text className={`text-lg font-bold flex-1 ${isDark ? "text-white" : "text-gray-900"}`} numberOfLines={1}>
              {session.title?.trim() || "Night Out"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 24 }}>
            <View>
              <Text className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                {formatDrinkTotal(session.drink_total).split(" ")[0]}
              </Text>
              <Text className={`text-xs ${muted}`}>{session.drink_total === 1 ? "drink" : "drinks"}</Text>
            </View>
            <View>
              <Text className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                {formatDuration(session.started_at, session.ended_at ?? new Date().toISOString())}
              </Text>
              <Text className={`text-xs ${muted}`}>{live ? "so far" : "long"}</Text>
            </View>
          </View>

          {members.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flexDirection: "row" }}>
                {members.slice(0, 5).map((m, i) => (
                  <View
                    key={m.user_id}
                    style={{ marginLeft: i > 0 ? -10 : 0, borderRadius: 99, borderWidth: 2 }}
                    className={isDark ? "border-gray-900" : "border-white"}
                  >
                    <Avatar uri={m.avatar_url} name={personName(m)} size={32} />
                  </View>
                ))}
              </View>
              <Text className={`text-sm flex-1 ${muted}`} numberOfLines={2}>
                {named.join(", ")}
                {moreCount > 0 ? ` and ${moreCount} more` : ""}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Get in */}
      <View style={{ gap: 12 }}>
        <Pressable
          onPress={onSignUp}
          className="bg-primary rounded-2xl items-center active:opacity-80"
          style={{ paddingVertical: 16 }}
          accessibilityRole="button"
        >
          <Text className="text-white font-bold text-base">{session && preview.can_join ? "Join on Suds" : "Join Suds"}</Text>
        </Pressable>
        <Text className={`text-xs text-center ${muted}`}>
          {copy.cta}
          {preview.inviter.is_private ? " (they approve followers)" : ""}. Free to sign up.
        </Text>
        <Pressable onPress={onSignIn} style={{ paddingVertical: 8 }} accessibilityRole="button">
          <Text className={`text-sm text-center font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            Have an account? <Text className="text-primary font-semibold">Sign in</Text>
          </Text>
        </Pressable>
      </View>

      {/* Install (web only: in the app you already have it) */}
      {isWeb && (
        <View className={`border-t ${isDark ? "border-gray-800" : "border-gray-200"}`} style={{ paddingTop: 20, gap: 14, alignItems: "center" }}>
          <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>Get the app</Text>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <AppStoreBadge variant={isDark ? "white" : "black"} height={44} />
            <GooglePlayButton variant={isDark ? "white" : "black"} height={44} />
          </View>
          <Link href={`suds://invite/${token}` as never} asChild>
            <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 }} accessibilityRole="link">
              <Image source={require("../../../assets/icon.png")} style={{ width: 18, height: 18, borderRadius: 4 }} />
              <Text className="text-sm text-primary font-semibold">Already have Suds? Open the app</Text>
              <Ionicons name="open-outline" size={14} color="#f59e0b" />
            </Pressable>
          </Link>
          <Text className={`text-xs text-center ${muted}`} style={{ maxWidth: 320 }}>
            Just installed? Come back and tap the link again to open it in the app.
          </Text>
        </View>
      )}
    </View>
  );
}
