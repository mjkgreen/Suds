import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { BirthdatePicker } from "@/components/profile/BirthdatePicker";

// ─── Unit Toggle ─────────────────────────────────────────────────────────────

interface UnitToggleProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: any) => void;
}

function UnitToggle({ options, value, onChange }: UnitToggleProps) {
  return (
    <View className="flex-row bg-muted rounded-lg p-1 mb-3">
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          className={`flex-1 py-2 px-4 rounded-md items-center ${value === opt.value ? "bg-card shadow-sm" : ""}`}
        >
          <Text className={`font-medium ${value === opt.value ? "text-primary" : "text-muted-foreground"}`}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { profile, setProfile } = useAuthStore();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [username, setUsername] = useState(profile?.username || "");
  const [name, setName] = useState(profile?.display_name || "");

  const [heightUnit, setHeightUnit] = useState<"in" | "cm">("in");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [heightCm, setHeightCm] = useState("");

  const [weightUnit, setWeightUnit] = useState<"lb" | "kg">("lb");
  const [weightValue, setWeightValue] = useState("");

  const [birthdate, setBirthdate] = useState("");
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  const handleNextStep = async () => {
    if (step === 1) {
      if (!username.trim() || !name.trim()) {
        Alert.alert("Error", "Username and name are required.");
        return;
      }
      setStep(2);
    } else {
      if (heightUnit === "in") {
        if (!heightFt.trim() || !heightIn.trim()) {
          Alert.alert("Error", "Please enter your height (feet and inches).");
          return;
        }
      } else {
        if (!heightCm.trim()) {
          Alert.alert("Error", "Please enter your height in cm.");
          return;
        }
      }
      if (!weightValue.trim()) {
        Alert.alert("Error", "Weight is required for BAC calculations.");
        return;
      }
      if (!birthdate) {
        Alert.alert("Error", "Date of birth is required for BAC calculations.");
        return;
      }
      await completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    if (!profile) return;
    setIsLoading(true);
    try {
      let finalHeight: number;
      if (heightUnit === "in") {
        finalHeight = parseInt(heightFt, 10) * 12 + parseInt(heightIn, 10);
      } else {
        finalHeight = parseFloat(heightCm);
      }
      const finalWeight = parseFloat(weightValue);

      if (isNaN(finalHeight) || isNaN(finalWeight)) {
        throw new Error("Please enter valid numbers for height and weight.");
      }

      const updates = {
        username: username.trim(),
        display_name: name.trim(),
        height: finalHeight,
        height_unit: heightUnit,
        weight: finalWeight,
        weight_unit: weightUnit,
        birthdate,
        onboarded: true,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabase as any)
        .from("profiles")
        .update(updates)
        .eq("id", profile.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data as any);
      // @ts-ignore
      router.replace("/(tabs)/feed");
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message || "Failed to complete onboarding");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "transparent" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        bounces
      >
        <Text className="text-3xl font-bold text-foreground mb-2">
          {step === 1 ? "Welcome to Suds!" : "Almost there!"}
        </Text>
        <Text className="text-muted-foreground mb-8 text-lg">
          {step === 1
            ? "Let's set up your profile so friends can find you."
            : "We need a few details to estimate your BAC. Your height, weight, and date of birth are private — only you can see them."}
        </Text>

        {step === 1 ? (
          <View className="gap-4">
            <View>
              <Text className="text-foreground mb-2 font-medium">Name</Text>
              <TextInput
                className="bg-card text-foreground p-4 rounded-xl border border-border"
                placeholder="Your full name"
                placeholderTextColor="#64748b"
                value={name}
                onChangeText={setName}
                returnKeyType="next"
              />
            </View>
            <View>
              <Text className="text-foreground mb-2 font-medium">Username</Text>
              <TextInput
                className="bg-card text-foreground p-4 rounded-xl border border-border"
                placeholder="Choose a username"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                returnKeyType="done"
              />
            </View>
          </View>
        ) : (
          <View className="gap-6">
            {/* Height */}
            <View>
              <Text className="text-foreground font-medium text-lg mb-1">Height</Text>
              <Text className="text-muted-foreground text-sm mb-2">Private — never shown to other users</Text>
              <UnitToggle
                value={heightUnit}
                onChange={setHeightUnit}
                options={[
                  { label: "Imperial (ft/in)", value: "in" },
                  { label: "Metric (cm)", value: "cm" },
                ]}
              />
              {heightUnit === "in" ? (
                <View className="flex-row gap-4">
                  <View className="flex-1">
                    <TextInput
                      className="bg-card text-foreground p-4 rounded-xl border border-border"
                      placeholder="ft"
                      placeholderTextColor="#64748b"
                      keyboardType="numeric"
                      value={heightFt}
                      onChangeText={setHeightFt}
                      returnKeyType="next"
                    />
                  </View>
                  <View className="flex-1">
                    <TextInput
                      className="bg-card text-foreground p-4 rounded-xl border border-border"
                      placeholder="in"
                      placeholderTextColor="#64748b"
                      keyboardType="numeric"
                      value={heightIn}
                      onChangeText={setHeightIn}
                      returnKeyType="next"
                    />
                  </View>
                </View>
              ) : (
                <TextInput
                  className="bg-card text-foreground p-4 rounded-xl border border-border"
                  placeholder="Height in cm"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  value={heightCm}
                  onChangeText={setHeightCm}
                  returnKeyType="next"
                />
              )}
            </View>

            {/* Weight */}
            <View>
              <Text className="text-foreground font-medium text-lg mb-1">Weight</Text>
              <Text className="text-muted-foreground text-sm mb-2">Private — never shown to other users</Text>
              <UnitToggle
                value={weightUnit}
                onChange={setWeightUnit}
                options={[
                  { label: "lbs", value: "lb" },
                  { label: "kg", value: "kg" },
                ]}
              />
              <TextInput
                className="bg-card text-foreground p-4 rounded-xl border border-border"
                placeholder={`Weight in ${weightUnit}`}
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={weightValue}
                onChangeText={setWeightValue}
                returnKeyType="done"
              />
            </View>

            {/* Date of Birth */}
            <View>
              <Text className="text-foreground font-medium text-lg mb-1">Date of Birth</Text>
              <Text className="text-muted-foreground text-sm mb-2">Private — never shown to other users</Text>
              <TouchableOpacity
                onPress={() => setIsDatePickerVisible(true)}
                activeOpacity={0.7}
                className="bg-card p-4 rounded-xl border border-border flex-row justify-between items-center"
              >
                <Text className={birthdate ? "text-foreground text-base" : "text-muted-foreground text-base"}>
                  {birthdate
                    ? new Date(birthdate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                    : "Select date of birth"}
                </Text>
                <Text style={{ fontSize: 16 }}>📅</Text>
              </TouchableOpacity>
              <BirthdatePicker
                isVisible={isDatePickerVisible}
                onClose={() => setIsDatePickerVisible(false)}
                currentDate={birthdate || null}
                onSave={(dateStr) => setBirthdate(dateStr ?? "")}
              />
            </View>
          </View>
        )}

        <TouchableOpacity
          className={`bg-primary p-4 rounded-full mt-10 items-center ${isLoading ? "opacity-50" : ""}`}
          onPress={handleNextStep}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text className="text-black font-semibold text-lg">{step === 1 ? "Continue" : "Complete Setup"}</Text>
          )}
        </TouchableOpacity>

        {step === 2 && !isLoading && (
          <TouchableOpacity className="p-4 mt-2 items-center" onPress={() => setStep(1)}>
            <Text className="text-muted-foreground font-medium">Back</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
