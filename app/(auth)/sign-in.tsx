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
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import * as AppleAuthentication from 'expo-apple-authentication';

export default function SignInScreen() {
  const { signInWithEmail, signInWithApple, signInWithGoogle } = useAuth();
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

  async function handleAppleSignIn() {
    setError(null);
    setLoading(true);
    try {
      await signInWithApple();
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        setError(err.message ?? 'Apple sign-in failed.');
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
            <View className="items-center mb-12">
              <Image
                source={require('../../assets/Suds.png')}
                style={{ width: 180, height: 80 }}
                contentFit="contain"
              />
              <Text className="text-gray-500 text-base mt-2">Strava for your drinking</Text>
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

              <View className="flex-row items-center justify-center mt-2 mb-2">
                <View className="flex-1 h-[1px] bg-gray-200" />
                <Text className="text-gray-400 px-4 font-medium text-sm">Or</Text>
                <View className="flex-1 h-[1px] bg-gray-200" />
              </View>

              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={{ width: '100%', height: 56, marginBottom: 12 }}
                  onPress={handleAppleSignIn}
                />
              )}

              <Button
                label="Sign in with Google"
                onPress={async () => {
                  setLoading(true);
                  try {
                    await signInWithGoogle();
                  } catch (err: any) {
                    setError(err.message ?? 'Google sign-in failed.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                variant="google"
                size="lg"
                icon={<Image source={require('../../assets/google-logo.svg')} style={{ width: 20, height: 20 }} contentFit="contain" />}
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
