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
      setProfile({ ...profile!, ...updated });
      setSaved(true);
      setTimeout(() => router.back(), 800);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save profile.');
    }
  }

  const previewUri = avatarUri ?? profile?.avatar_url ?? null;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
          <Pressable onPress={() => router.back()} className="p-2 mr-2">
            <Ionicons name="arrow-back" size={22} color="#374151" />
          </Pressable>
          <Text className="font-bold text-gray-900 text-base flex-1">Edit Profile</Text>
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
                className="absolute bottom-0 right-0 bg-amber-400 rounded-full p-1.5"
                style={{ borderWidth: 2, borderColor: '#f9fafb' }}
              >
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </Pressable>
            <Text className="text-gray-400 text-xs mt-2">Tap to change photo</Text>
          </View>

          <View>
            <Text className="text-gray-700 font-semibold mb-1.5 text-sm">Display Name</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
              placeholder="Your full name or nickname"
              placeholderTextColor="#9ca3af"
              value={displayName}
              onChangeText={setDisplayName}
              autoCorrect={false}
            />
            <Text className="text-gray-400 text-xs mt-1">This is what others see in the feed</Text>
          </View>

          <View>
            <Text className="text-gray-700 font-semibold mb-1.5 text-sm">
              Username <Text className="text-red-400">*</Text>
            </Text>
            <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3">
              <Text className="text-gray-400 text-base mr-0.5">@</Text>
              <TextInput
                className="flex-1 text-base text-gray-900"
                placeholder="your_handle"
                placeholderTextColor="#9ca3af"
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Text className="text-gray-400 text-xs mt-1">Letters, numbers, underscores only</Text>
          </View>

          <View>
            <Text className="text-gray-700 font-semibold mb-1.5 text-sm">Bio</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
              placeholder="Tell people what you drink…"
              placeholderTextColor="#9ca3af"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
            />
          </View>

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <Text className="text-red-600 text-sm">{error}</Text>
            </View>
          )}

          {saved && (
            <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <Text className="text-green-700 text-sm font-medium">Profile saved!</Text>
            </View>
          )}

          <Button label="Save Changes" onPress={handleSave} loading={isPending} size="lg" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
