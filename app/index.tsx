import { ActivityIndicator, Platform, View } from "react-native";
import Head from "expo-router/head";
import { MarketingHomepage } from "@/components/web/MarketingHomepage";

export default function Index() {
  if (Platform.OS !== "web") {
    // The root layout's AuthGuard sends the user to the feed or sign-in once it
    // knows which. Don't jump to sign-in here — that flashed the sign-in screen
    // on every launch, and stranded signed-in users there if their profile was slow.
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }
  // On web: show marketing homepage for unauthenticated users.
  // Authenticated + onboarded users are redirected to /feed by AuthGuard.
  return (
    <>
      <Head>
        <title>Suds | Track your drinks. Know your limits.</title>
        <meta
          name="description"
          content="The social drink tracker that helps you log what you drink, track your BAC, and share the night with friends."
        />
        <meta property="og:title" content="Suds — Track your drinks. Know your limits." />
        <meta
          property="og:description"
          content="The social drink tracker that helps you log what you drink, track your BAC, and share the night with friends."
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Suds — Track your drinks. Know your limits." />
        <meta
          name="twitter:description"
          content="The social drink tracker that helps you log what you drink, track your BAC, and share the night with friends."
        />
      </Head>
      <MarketingHomepage />
    </>
  );
}
