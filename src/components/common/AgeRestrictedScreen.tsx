import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { underageMessage } from '@/lib/ageCheck';

/**
 * Shown instead of the app to someone who isn't of legal drinking age where
 * they are. They can check again (e.g. after travelling home) or sign out.
 */
export function AgeRestrictedScreen({
  minimumAge,
  place,
  checking,
  onCheckAgain,
  onSignOut,
}: {
  minimumAge: number;
  place: string | null;
  checking: boolean;
  onCheckAgain: () => void;
  onSignOut: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <View className="w-16 h-16 rounded-full bg-accent items-center justify-center mb-4">
        <Ionicons name="lock-closed" size={28} color="#f59e0b" />
      </View>
      <Text className="text-foreground text-xl font-bold text-center">Suds is for adults</Text>
      <Text className="text-muted-foreground text-base text-center mt-3" style={{ lineHeight: 24 }}>
        {underageMessage({ minimumAge, place })} If you think this is wrong, check that your date of birth
        {Platform.OS === 'ios' ? ' and your Apple Account age are' : ' is'} correct, then try again.
      </Text>
      <Pressable
        onPress={onCheckAgain}
        disabled={checking}
        className={`mt-8 bg-primary rounded-xl px-6 py-3 active:opacity-90 ${checking ? 'opacity-50' : ''}`}
      >
        {checking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-primary-foreground font-semibold">Check again</Text>
        )}
      </Pressable>
      <Pressable onPress={onSignOut} className="mt-4 px-6 py-3">
        <Text className="text-muted-foreground font-semibold">Sign out</Text>
      </Pressable>
    </View>
  );
}
