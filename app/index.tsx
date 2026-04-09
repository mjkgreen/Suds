import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { MarketingHomepage } from '@/components/web/MarketingHomepage';

export default function Index() {
  if (Platform.OS !== 'web') {
    return <Redirect href="/(auth)/sign-in" />;
  }
  // On web: show marketing homepage for unauthenticated users.
  // Authenticated + onboarded users are redirected to /feed by AuthGuard.
  return <MarketingHomepage />;
}
