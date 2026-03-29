import { Link } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';

export default function SignInScreen() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-amber-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-16 pb-10">
            {/* Header */}
            <View className="items-center mb-12">
              <Text className="text-6xl mb-3">🍺</Text>
              <Text className="text-4xl font-bold text-amber-600">Suds</Text>
              <Text className="text-gray-500 text-base mt-1">Strava for your drinking</Text>
            </View>

            {/* Form */}
            <View className="gap-4">
              <View>
                <Text className="text-gray-700 font-medium mb-1.5 text-sm">Email</Text>
                <TextInput
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                  placeholder="you@example.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <View>
                <Text className="text-gray-700 font-medium mb-1.5 text-sm">Password</Text>
                <TextInput
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                />
              </View>

              {error && (
                <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <Text className="text-red-600 text-sm">{error}</Text>
                </View>
              )}

              <Button
                label="Sign In"
                onPress={handleSignIn}
                loading={loading}
                size="lg"
                className="mt-2"
              />
            </View>

            {/* Footer */}
            <View className="flex-row justify-center mt-8">
              <Text className="text-gray-500">Don't have an account? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable>
                  <Text className="text-amber-600 font-semibold">Sign up</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
