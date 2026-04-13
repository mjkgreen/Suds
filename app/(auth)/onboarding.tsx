import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Gender } from "@/types/models";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEAR_START = 1920;
const ITEM_H = 46;
const VISIBLE = 5; // rows shown (odd → center = selected)
const HALF = Math.floor(VISIBLE / 2);

function numDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// ─── ScrollPicker ─────────────────────────────────────────────────────────────

interface ScrollPickerProps {
  items: string[];
  selectedIndex: number;
  onIndexChange: (i: number) => void;
}

function ScrollPicker({ items, selectedIndex, onIndexChange }: ScrollPickerProps) {
  const ref = useRef<ScrollView>(null);
  const [vis, setVis] = useState(selectedIndex);

  // Keep scroll in sync when parent changes selectedIndex (e.g. day clamped)
  useEffect(() => {
    setVis(selectedIndex);
    ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
  }, [selectedIndex]);

  // Set initial position after the view has laid out (no setTimeout needed)
  const onLayout = () => {
    ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    setVis(Math.max(0, Math.min(idx, items.length - 1)));
  };

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    setVis(clamped);
    onIndexChange(clamped);
  };

  return (
    <View style={{ flex: 1, height: ITEM_H * VISIBLE }}>
      {/* Fixed highlight band at the center row */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: ITEM_H * HALF,
          left: 4,
          right: 4,
          height: ITEM_H,
          borderRadius: 10,
          backgroundColor: "rgba(250,204,21,0.09)",
          borderWidth: 1,
          borderColor: "rgba(250,204,21,0.22)",
        }}
      />
      <ScrollView
        ref={ref}
        onLayout={onLayout}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={onEnd}
        onScrollEndDrag={onEnd}
        contentContainerStyle={{ paddingVertical: ITEM_H * HALF }}
      >
        {items.map((label, i) => {
          const dist = Math.abs(i - vis);
          return (
            <View key={i} style={{ height: ITEM_H, alignItems: "center", justifyContent: "center" }}>
              <Text
                style={{
                  color: "#f1f5f9",
                  fontSize: dist === 0 ? 17 : 15,
                  fontWeight: dist === 0 ? "600" : "400",
                  opacity: dist === 0 ? 1 : dist === 1 ? 0.4 : 0.15,
                }}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── DOB Picker ───────────────────────────────────────────────────────────────

interface DOBPickerProps {
  value: string; // "" or "YYYY-MM-DD"
  onChange: (v: string) => void;
}

function DOBPicker({ value, onChange }: DOBPickerProps) {
  const today = new Date();
  const currentYear = today.getFullYear();

  const parsed = value ? new Date(value + "T12:00:00") : null;
  const initYear = (parsed?.getFullYear() ?? currentYear - 25) - YEAR_START;
  const initMonth = parsed?.getMonth() ?? 0;
  const initDay = parsed ? parsed.getDate() - 1 : 0;

  const [open, setOpen] = useState(false);
  const [selMonth, setSelMonth] = useState(initMonth);
  const [selDay, setSelDay] = useState(initDay);
  const [selYear, setSelYear] = useState(initYear);

  const years = Array.from({ length: currentYear - YEAR_START + 1 }, (_, i) => String(YEAR_START + i));

  const nd = numDaysInMonth(YEAR_START + selYear, selMonth);
  const days = Array.from({ length: nd }, (_, i) => String(i + 1));
  const safeDay = Math.min(selDay, nd - 1);

  const handleMonth = (i: number) => {
    setSelMonth(i);
    const n = numDaysInMonth(YEAR_START + selYear, i);
    if (selDay >= n) setSelDay(n - 1);
  };

  const handleYear = (i: number) => {
    setSelYear(i);
    const n = numDaysInMonth(YEAR_START + i, selMonth);
    if (selDay >= n) setSelDay(n - 1);
  };

  const handleDone = () => {
    const y = String(YEAR_START + selYear);
    const m = String(selMonth + 1).padStart(2, "0");
    const d = String(safeDay + 1).padStart(2, "0");
    onChange(`${y}-${m}-${d}`);
    setOpen(false);
  };

  const displayText = parsed
    ? parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "Select date of birth";

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        className="bg-card p-4 rounded-xl border border-border flex-row justify-between items-center"
      >
        <Text className={value ? "text-foreground text-base" : "text-muted-foreground text-base"}>{displayText}</Text>
        <Text style={{ fontSize: 16 }}>📅</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          {/* Dimmed backdrop */}
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
            activeOpacity={1}
            onPress={() => setOpen(false)}
          />

          {/* Sheet */}
          <View style={{ backgroundColor: "#0f172a", borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
            {/* Handle */}
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 2 }}>
              <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: "#1e3a5f" }} />
            </View>

            {/* Toolbar */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255,255,255,0.07)",
              }}
            >
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={{ color: "#64748b", fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color: "#f1f5f9", fontWeight: "600", fontSize: 16 }}>Date of Birth</Text>
              <TouchableOpacity onPress={handleDone}>
                <Text style={{ color: "#facc15", fontWeight: "700", fontSize: 16 }}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Column labels */}
            <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
              {["MONTH", "DAY", "YEAR"].map((lbl) => (
                <View key={lbl} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ color: "#475569", fontSize: 11, fontWeight: "600", letterSpacing: 0.6 }}>{lbl}</Text>
                </View>
              ))}
            </View>

            {/* Three scroll pickers */}
            <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingBottom: 44 }}>
              <ScrollPicker items={MONTHS} selectedIndex={selMonth} onIndexChange={handleMonth} />
              <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 10 }} />
              <ScrollPicker items={days} selectedIndex={safeDay} onIndexChange={setSelDay} />
              <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 10 }} />
              <ScrollPicker items={years} selectedIndex={selYear} onIndexChange={handleYear} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

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
  const [gender, setGender] = useState<Gender | null>(null);

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
      if (!gender) {
        Alert.alert("Error", "Please select your biological sex for accurate BAC calculations.");
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
        gender,
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
              <DOBPicker value={birthdate} onChange={setBirthdate} />
            </View>

            {/* Biological Sex */}
            <View>
              <Text className="text-foreground font-medium text-lg mb-1">Biological Sex</Text>
              <Text className="text-muted-foreground text-sm mb-3">
                Used for BAC estimates (Widmark formula). Private — never shown to other users.
              </Text>
              <View className="flex-row gap-3">
                {(["male", "female", "other"] as Gender[]).map((g) => {
                  const labels: Record<Gender, string> = { male: "Male", female: "Female", other: "Other" };
                  const isSelected = gender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setGender(g)}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: "center",
                        backgroundColor: isSelected ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.05)",
                        borderWidth: 1.5,
                        borderColor: isSelected ? "#facc15" : "rgba(255,255,255,0.1)",
                      }}
                    >
                      <Text
                        style={{
                          color: isSelected ? "#facc15" : "#94a3b8",
                          fontWeight: isSelected ? "700" : "500",
                          fontSize: 15,
                        }}
                      >
                        {labels[g]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
