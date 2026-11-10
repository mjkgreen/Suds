import { ActivityIndicator, Platform, View } from "react-native";
import Head from "expo-router/head";
import { MarketingHomepage } from "@/components/web/MarketingHomepage";
import { WEB_ORIGIN } from "@/lib/share";

const TITLE = "Suds | The social drink tracker";
const DESCRIPTION =
  "Log every drink, follow friends, share your nights out, and track your stats, streaks and pace with Suds, the social drink tracker.";

// schema.org markup that tells search engines and AI assistants what Suds is.
const APP_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Suds",
  description: DESCRIPTION,
  url: WEB_ORIGIN,
  applicationCategory: "SocialNetworkingApplication",
  operatingSystem: "iOS, Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
});

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
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={`${WEB_ORIGIN}/`} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={`${WEB_ORIGIN}/`} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <script type="application/ld+json">{APP_JSON_LD}</script>
      </Head>
      <MarketingHomepage />
    </>
  );
}
