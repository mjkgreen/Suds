import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';

interface PublicLayoutProps {
  children: React.ReactNode;
}

function PublicHeader() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className={`w-full border-b ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}
      style={{ paddingHorizontal: 24, paddingVertical: 14 }}
    >
      <View style={{ maxWidth: 1100, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo + wordmark */}
        <Pressable onPress={() => router.push('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image
            source={require('../../../assets/icon.png')}
            style={{ width: 32, height: 32, borderRadius: 8 }}
            contentFit="cover"
          />
          <Text className="text-xl font-bold text-primary" style={{ letterSpacing: -0.5 }}>
            Suds
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable onPress={() => router.push('/(auth)/sign-in' as never)}>
            <Text className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(auth)/sign-up' as never)}
            className="bg-primary rounded-full px-5 py-2"
          >
            <Text className="text-white text-sm font-semibold">Get Started</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PublicFooter() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className={`w-full border-t ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-100'}`}
      style={{ paddingHorizontal: 24, paddingVertical: 40 }}
    >
      <View style={{ maxWidth: 1100, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 32, marginBottom: 32 }}>
          {/* Brand + App Store */}
          <View style={{ gap: 16 }}>
            <Pressable onPress={() => router.push('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image
                source={require('../../../assets/icon.png')}
                style={{ width: 28, height: 28, borderRadius: 6 }}
                contentFit="cover"
              />
              <Text className="text-lg font-bold text-primary" style={{ letterSpacing: -0.5 }}>Suds</Text>
            </Pressable>
            <Text className={`text-xs max-w-xs leading-relaxed ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              The social drink tracker. Know your limits. Follow friends.
            </Text>
            {/* App Store badge */}
            <Pressable
              className={`self-start rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 }}
            >
              <Ionicons name="logo-apple" size={20} color={isDark ? '#fff' : '#111827'} />
              <View>
                <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Download on the</Text>
                <Text className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>App Store</Text>
              </View>
            </Pressable>
          </View>

          {/* Links */}
          <View style={{ flexDirection: 'row', gap: 48, flexWrap: 'wrap' }}>
            <View style={{ gap: 12 }}>
              <Text className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Product</Text>
              <Pressable onPress={() => router.push('/(auth)/sign-up' as never)}>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Get Started</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/(auth)/sign-in' as never)}>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Sign In</Text>
              </Pressable>
            </View>
            <View style={{ gap: 12 }}>
              <Text className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Legal</Text>
              <Pressable onPress={() => router.push('/support' as never)}>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Support</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/privacy' as never)}>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Privacy Policy</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/terms' as never)}>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Terms of Service</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View className={`h-px w-full mb-6 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />

        <Text className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          © {new Date().getFullYear()} Suds. All rights reserved. Drink responsibly.
        </Text>
      </View>
    </View>
  );
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-950' : 'bg-white'}`}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        stickyHeaderIndices={[0]}
      >
        <PublicHeader />
        <View style={{ flex: 1 }}>
          {children}
        </View>
        <PublicFooter />
      </ScrollView>
    </View>
  );
}
