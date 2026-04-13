import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/common/Button";
import { uploadAvatarPhoto } from "@/lib/storage";
import { useUpdateProfile } from "@/hooks/useProfile";
import { useAuthStore } from "@/stores/authStore";
import { useColorScheme } from "nativewind";
import { Gender, Profile } from "@/types/models";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, profile, setProfile } = useAuthStore();
  const { mutateAsync: updateProfile, isPending } = useUpdateProfile();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  
  // Height State
  const [heightUnit, setHeightUnit] = useState<'in' | 'cm'>(profile?.height_unit || 'in');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [heightCm, setHeightCm] = useState('');

  // Weight State
  const [weightValue, setWeightValue] = useState(profile?.weight?.toString() ?? "");
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>(profile?.weight_unit || 'lb');

  // Date of Birth State (display as MM/DD/YYYY, store as YYYY-MM-DD)
  const [birthdate, setBirthdate] = useState(() => {
    if (!profile?.birthdate) return "";
    const [y, m, d] = profile.birthdate.split('-');
    return `${m}/${d}/${y}`;
  });

  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setUsername(profile?.username ?? "");
    setBio(profile?.bio ?? "");
    setBirthdate(() => {
      if (!profile?.birthdate) return "";
      const [y, m, d] = profile.birthdate.split('-');
      return `${m}/${d}/${y}`;
    });
    setHeightUnit(profile?.height_unit || 'in');
    setWeightUnit(profile?.weight_unit || 'lb');
    setWeightValue(profile?.weight?.toString() ?? "");
    setGender(profile?.gender ?? null);

    if (profile?.height) {
      if (profile.height_unit === 'in') {
        setHeightFt(Math.floor(profile.height / 12).toString());
        setHeightIn((profile.height % 12).toString());
      } else {
        setHeightCm(profile.height.toString());
      }
    }
  }, [profile]);

  async function launchAvatarPicker(useCamera: boolean) {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    };
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return;
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
    Alert.alert("Change Photo", undefined, [
      { text: "Take Photo", onPress: () => launchAvatarPicker(true) },
      { text: "Choose from Library", onPress: () => launchAvatarPicker(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function handleSave() {
    if (!user) return;
    setError(null);
    setSaved(false);

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (!trimmedUsername) {
      setError("Username is required.");
      return;
    }

    try {
      let finalHeight: number | null = null;
      if (heightUnit === 'in') {
        if (heightFt || heightIn) {
          finalHeight = (parseInt(heightFt || '0', 10) * 12) + parseInt(heightIn || '0', 10);
        }
      } else if (heightCm) {
        finalHeight = parseFloat(heightCm);
      }

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
          height: finalHeight,
          height_unit: heightUnit,
          weight: weightValue ? parseFloat(weightValue) : null,
          weight_unit: weightUnit,
          birthdate: birthdate ? new Date(birthdate).toISOString().split('T')[0] : null,
          gender: gender ?? null,
        },
      });
      
      if (profile) {
        setProfile({ ...profile, ...(updated as Profile) });
      } else {
        setProfile(updated as Profile);
      }
      setSaved(true);
      setTimeout(() => router.back(), 800);
    } catch (err: any) {
      setError(err.message ?? "Failed to save profile.");
    }
  }

  const UnitToggle = ({ 
    options, 
    value, 
    onChange 
  }: { 
    options: { label: string, value: string }[], 
    value: string, 
    onChange: (v: any) => void 
  }) => (
    <View className="flex-row bg-muted rounded-lg p-1 mb-2">
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          className={`flex-1 py-1.5 rounded items-center ${value === opt.value ? 'bg-card shadow-sm' : ''}`}
        >
          <Text className={`text-xs font-medium ${value === opt.value ? 'text-primary' : 'text-muted-foreground'}`}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const previewUri = avatarUri ?? profile?.avatar_url ?? null;
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <SafeAreaView className={`flex-1 bg-background ${isDark ? "dark" : ""}`}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <View className="flex-row items-center px-4 py-3 bg-background border-b border-border">
          <Pressable onPress={() => router.back()} className="p-2 mr-2">
            <Ionicons name="arrow-back" size={22} color="orange" />
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
              <Avatar uri={previewUri} name={displayName || username || "U"} size={88} />
              <View
                className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5"
                style={{ borderWidth: 2, borderColor: isDark ? "hsl(var(--background))" : "#f9fafb" }}
              >
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </Pressable>
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-1.5 text-sm">Display Name</Text>
            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
              placeholder="Your name"
              placeholderTextColor="hsl(var(--muted-foreground))"
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-1.5 text-sm">Username</Text>
            <View className="flex-row items-center bg-card border border-border rounded-xl px-4 py-3">
              <Text className="text-muted-foreground text-base mr-0.5">@</Text>
              <TextInput
                className="flex-1 text-base text-foreground"
                placeholder="username"
                placeholderTextColor="hsl(var(--muted-foreground))"
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase())}
                autoCapitalize="none"
              />
            </View>
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
              style={{ minHeight: 80 }}
            />
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-0.5 text-sm">Date of Birth</Text>
            <Text className="text-muted-foreground text-xs mb-1.5">Private — only used for BAC estimates</Text>
            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
              placeholder="MM/DD/YYYY"
              placeholderTextColor="hsl(var(--muted-foreground))"
              value={birthdate}
              onChangeText={setBirthdate}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-0.5 text-sm">Biological Sex</Text>
            <Text className="text-muted-foreground text-xs mb-2">Private — used for BAC estimates (Widmark formula)</Text>
            <View className="flex-row gap-2">
              {(["male", "female", "other"] as Gender[]).map((g) => {
                const labels: Record<Gender, string> = { male: "Male", female: "Female", other: "Other" };
                const isSelected = gender === g;
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setGender(g)}
                    className={`flex-1 py-3 rounded-xl items-center border ${
                      isSelected ? "border-primary bg-primary/10" : "border-border bg-card"
                    }`}
                  >
                    <Text className={`text-sm font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                      {labels[g]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-1.5 text-sm">Height</Text>
            <UnitToggle 
              value={heightUnit} 
              onChange={setHeightUnit} 
              options={[{ label: 'Imperial (ft/in)', value: 'in' }, { label: 'Metric (cm)', value: 'cm' }]} 
            />
            {heightUnit === 'in' ? (
              <View className="flex-row gap-2">
                <TextInput
                  className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
                  placeholder="ft"
                  placeholderTextColor="hsl(var(--muted-foreground))"
                  value={heightFt}
                  onChangeText={setHeightFt}
                  keyboardType="numeric"
                />
                <TextInput
                  className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
                  placeholder="in"
                  placeholderTextColor="hsl(var(--muted-foreground))"
                  value={heightIn}
                  onChangeText={setHeightIn}
                  keyboardType="numeric"
                />
              </View>
            ) : (
              <TextInput
                className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
                placeholder="cm"
                placeholderTextColor="hsl(var(--muted-foreground))"
                value={heightCm}
                onChangeText={setHeightCm}
                keyboardType="numeric"
              />
            )}
          </View>

          <View>
            <Text className="text-foreground font-semibold mb-1.5 text-sm">Weight</Text>
            <UnitToggle 
              value={weightUnit} 
              onChange={setWeightUnit} 
              options={[{ label: 'lbs', value: 'lb' }, { label: 'kg', value: 'kg' }]} 
            />
            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground"
              placeholder={`Weight in ${weightUnit}`}
              placeholderTextColor="hsl(var(--muted-foreground))"
              value={weightValue}
              onChangeText={setWeightValue}
              keyboardType="numeric"
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
