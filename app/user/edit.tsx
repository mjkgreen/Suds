import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { uploadAvatarPhoto } from '@/lib/storage';
import { useUpdateProfile } from '@/hooks/useProfile';
import { useAuthStore } from '@/stores/authStore';
import { useColorScheme } from 'nativewind';
import { Profile } from '@/types/models';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, profile, setProfile } = useAuthStore();
  const { mutateAsync: updateProfile, isPending } = useUpdateProfile();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
    setUsername(profile?.username ?? '');
    setBio(profile?.bio ?? '');
  }, [profile]);

  async function launchAvatarPicker(useCamera: boolean) {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    };
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
      setAvatarBase64(result.assets[0].base64 ?? null);
    }
  }

  function handlePickAvatar() {
    Alert.alert('Change Photo', undefined, [
      { text: 'Take Photo', onPress: () => launchAvatarPicker(true) },
      { text: 'Choose from Library', onPress: () => launchAvatarPicker(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSave() {
    if (!user) return;
    setError(null);
    setSaved(false);

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (!trimmedUsername) {
      setError('Username is required.');
      return;
    }
    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
      setError('Username can only contain letters, numbers, and underscores.');
      return;
    }

    try {
      let newAvatarUrl: string | null = profile?.avatar_url ?? null;
      if (avatarUri) {
        newAvatarUrl = await uploadAvatarPhoto(user.id, avatarUri, avatarBase64);
      }

      const updated = await updateProfile({
        userId: user.id,
        updates: {
          display_name: trimmedName || null,
          username: trimmedUsername,
          bio: bio.trim() || null,
          avatar_url: newAvatarUrl,
        },
      });
      if (profile) {
        setProfile({ ...profile, ...updated });
      } else {
        setProfile(updated as Profile);
      }
      setSaved(true);
      setTimeout(() => router.back(), 800);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save profile.');
    }
  }

  const previewUri = avatarUri ?? profile?.avatar_url ?? null;

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? 'dark' : ''}`}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-row items-center px-4 py-3 bg-background border-b border-border">
          <Pressable onPress={() => router.back()} className="p-2 mr-2">
            <Ionicons name="arrow-back" size={22} color="hsl(var(--foreground))" />
          </Pressable>
          <Text className="font-bold text-foreground text-base flex-1">Edit Profile</Text>
          {isPending && <ActivityIndicator size="small" color="#f59e0b" />}
        </View>
 
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, gap: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center">
            <Pressable onPress={handlePickAvatar} className="relative">
              <Avatar uri={previewUri} name={displayName || username || 'U'} size={88} />
              <View
                className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5"
                style={{ borderWidth: 2, borderColor: isDark ? 'hsl(var(--background))' : '#f9fafb' }}
              >
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </Pressable>
            <Text className="text-muted-foreground text-xs mt-2">Tap to change photo</Text>
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-1.5 text-sm">Display Name</Text>
            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
              placeholder="Your full name or nickname"
              placeholderTextColor="hsl(var(--muted-foreground))"
              value={displayName}
              onChangeText={setDisplayName}
              autoCorrect={false}
            />
            <Text className="text-muted-foreground text-xs mt-1">This is what others see in the feed</Text>
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-1.5 text-sm">
              Username <Text className="text-destructive">*</Text>
            </Text>
            <View className="flex-row items-center bg-card border border-border rounded-xl px-4 py-3">
              <Text className="text-muted-foreground text-base mr-0.5">@</Text>
              <TextInput
                className="flex-1 text-base text-foreground"
                placeholder="your_handle"
                placeholderTextColor="hsl(var(--muted-foreground))"
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Text className="text-muted-foreground text-xs mt-1">Letters, numbers, underscores only</Text>
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-1.5 text-sm">Bio</Text>
            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
              placeholder="Tell people what you drink…"
              placeholderTextColor="hsl(var(--muted-foreground))"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
            />
          </View>

          {error && (
            <View className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
              <Text className="text-destructive text-sm">{error}</Text>
            </View>
          )}

          {saved && (
            <View className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
              <Text className="text-green-700 dark:text-green-400 text-sm font-medium">Profile saved!</Text>
            </View>
          )}

          <Button label="Save Changes" onPress={handleSave} loading={isPending} size="lg" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
