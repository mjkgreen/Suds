import { Platform } from 'react-native';
import { Redirect } from 'expo-router';
import Head from 'expo-router/head';
import { MarketingHomepage } from '@/components/web/MarketingHomepage';

export default function Index() {
  if (Platform.OS !== 'web') {
    return <Redirect href="/(auth)/sign-in" />;
  }
  // On web: show marketing homepage for unauthenticated users.
  // Authenticated + onboarded users are redirected to /feed by AuthGuard.
  return (
    <>
      <Head>
        <title>Suds — Track your drinks. Know your limits.</title>
        <meta name="description" content="The social drink tracker that helps you log what you drink, track your BAC, and share the night with friends." />
        <meta property="og:title" content="Suds — Track your drinks. Know your limits." />
        <meta property="og:description" content="The social drink tracker that helps you log what you drink, track your BAC, and share the night with friends." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Suds — Track your drinks. Know your limits." />
        <meta name="twitter:description" content="The social drink tracker that helps you log what you drink, track your BAC, and share the night with friends." />
      </Head>
      <MarketingHomepage />
    </>
  );
}
