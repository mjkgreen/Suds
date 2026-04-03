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
import * as AppleAuthentication from 'expo-apple-authentication';

export default function SignUpScreen() {
  const { signUpWithEmail, signInWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!email.trim() || !username.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username.toLowerCase())) {
      setError('Username can only contain letters, numbers, and underscores.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(
        email.trim().toLowerCase(),
        password,
        username.toLowerCase().trim(),
      );
      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignUp() {
    setError(null);
    setLoading(true);
    try {
      await signInWithApple();
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        setError(err.message ?? 'Apple sign-up failed.');
      }
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
            <View className="items-center mb-10">
              <Text className="text-6xl mb-3">🍺</Text>
              <Text className="text-3xl font-bold text-amber-600">Join Suds</Text>
              <Text className="text-gray-500 text-sm mt-1">Track your drinks. Follow friends.</Text>
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
                <Text className="text-gray-700 font-medium mb-1.5 text-sm">Username</Text>
                <TextInput
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
                  placeholder="craft_beer_fan"
                  placeholderTextColor="#9ca3af"
                  value={username}
                  onChangeText={(t) => setUsername(t.toLowerCase())}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text className="text-gray-400 text-xs mt-1">
                  Letters, numbers, underscores only
                </Text>
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
                  autoComplete="new-password"
                />
                <Text className="text-gray-400 text-xs mt-1">Minimum 8 characters</Text>
              </View>

              {error && (
                <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <Text className="text-red-600 text-sm">{error}</Text>
                </View>
              )}

              {success && (
                <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <Text className="text-green-700 text-sm font-medium">Check your email!</Text>
                  <Text className="text-green-600 text-sm mt-0.5">
                    We sent you a confirmation link. Tap it to activate your account.
                  </Text>
                </View>
              )}

              <Button
                label="Create Account"
                onPress={handleSignUp}
                loading={loading}
                disabled={success}
                size="lg"
                className="mt-2"
              />

              {Platform.OS === 'ios' && !success && (
                <>
                  <View className="flex-row items-center justify-center mt-2 mb-2">
                    <View className="flex-1 h-[1px] bg-gray-200" />
                    <Text className="text-gray-400 px-4 font-medium text-sm">Or</Text>
                    <View className="flex-1 h-[1px] bg-gray-200" />
                  </View>

                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={12}
                    style={{ width: '100%', height: 56 }}
                    onPress={handleAppleSignUp}
                  />
                </>
              )}
            </View>

            {/* Footer */}
            <View className="flex-row justify-center mt-8">
              <Text className="text-gray-500">Already have an account? </Text>
              <Link href="/(auth)/sign-in" asChild>
                <Pressable>
                  <Text className="text-amber-600 font-semibold">Sign in</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
