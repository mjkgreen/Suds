import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Platform, View } from 'react-native';
import { SessionBanner } from '@/components/session/SessionBanner';
import { useMyOpenSession } from '@/hooks/useSession';
import { useAuthStore } from '@/stores/authStore';
import { WebNavBar } from '@/components/web/WebNavBar';

function TabsLayoutInner() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#f59e0b',
        tabBarInactiveTintColor: isDark ? '#6b7280' : '#9ca3af',
        tabBarStyle: isWeb
          ? { display: 'none' }
          : {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderTopColor: isDark ? '#1f2937' : '#f3f4f6',
              height: 84,
              paddingBottom: 28,
              paddingTop: 8,
              borderTopWidth: 1,
              elevation: 0,
            },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="beer-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ color }) => (
            <View className="w-12 h-12 bg-primary rounded-full items-center justify-center -mt-4 shadow-lg shadow-primary/30">
              <Ionicons name="add" size={28} color="#fff" />
            </View>
          ),
          tabBarLabel: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  const { user } = useAuthStore();
  // Hydrates sessionStore with any open session from the DB on mount
  useMyOpenSession(user?.id);

  return (
    <View className="flex-1">
      {Platform.OS === 'web' && <WebNavBar />}
      <SessionBanner />
      <TabsLayoutInner />
    </View>
  );
}
