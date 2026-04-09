import { View } from 'react-native';
import { useColorScheme } from 'nativewind';

interface WebShellProps {
  children: React.ReactNode;
}

/**
 * Centers and constrains content width on web, matching Strava's layout pattern.
 * Wraps the main scrollable content area inside each authenticated tab screen.
 */
export function WebShell({ children }: WebShellProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className={`flex-1 ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}
    >
      <View
        style={{
          flex: 1,
          maxWidth: 680,
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: 16,
        }}
      >
        {children}
      </View>
    </View>
  );
}
