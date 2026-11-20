import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, Pressable } from "react-native";
import { useShareInviteLink } from "@/hooks/useShareLinks";

interface InviteFriendsButtonProps {
  /** Icon size; the button's padding stays the same. */
  size?: number;
}

/**
 * Icon button that shares your personal "join me on Suds" link. Used next to
 * the search bar and in the profile header. Turning the link off lives in
 * Settings (ShareInviteLinkSection).
 */
export function InviteFriendsButton({ size = 20 }: InviteFriendsButtonProps) {
  const share = useShareInviteLink();

  function handlePress() {
    share.mutate(
      { kind: "profile" },
      { onError: () => Alert.alert("Couldn't share", "Something went wrong making the link. Try again.") },
    );
  }

  return (
    <Pressable
      className="bg-accent rounded-xl p-2 items-center justify-center active:opacity-80"
      onPress={handlePress}
      disabled={share.isPending}
      accessibilityRole="button"
      accessibilityLabel="Invite friends to Suds"
      hitSlop={4}
    >
      {share.isPending ? (
        <ActivityIndicator size="small" color="#6b7280" style={{ width: size, height: size }} />
      ) : (
        <Ionicons name="person-add-outline" size={size} color="#6b7280" />
      )}
    </Pressable>
  );
}
