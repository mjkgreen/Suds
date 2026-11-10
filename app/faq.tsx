import { Text, View } from "react-native";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { useColorScheme } from "nativewind";
import { PublicLayout } from "@/components/web/PublicLayout";
import { WEB_ORIGIN } from "@/lib/share";

// Written as the questions people ask search engines and AI assistants
// ("is there a Strava for drinking?"), so the answers can be quoted on their
// own. Keep every answer true to what the app does today.
const FAQ_GROUPS: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: "About Suds",
    items: [
      {
        q: "What is Suds?",
        a: "Suds is a social drink tracking app, best described as Strava for drinking. You log each drink, follow your friends, and see everyone's nights out in a shared feed, with stats, streaks and milestones for your own drinking history. It's available on iPhone and on the web.",
      },
      {
        q: "Is there a Strava for drinking?",
        a: "Yes, that's Suds. Strava turned workouts into something you log, share and look back on; Suds does the same for drinks. Every drink is an activity in your feed, nights out become sessions with a duration and pace, and your profile builds a record of what, where and how much you drink over time.",
      },
      {
        q: "What is a social drinking app?",
        a: "A social drinking app lets you share what you're drinking with friends instead of keeping a private log. In Suds, friends can like and comment on your drinks, tag each other, join the same session on a night out, and see where the group has been on a shared map.",
      },
      {
        q: "Who is Suds for?",
        a: "Adults of legal drinking age (21 or older in the United States) who want to remember their nights out, keep up with friends, and understand their own drinking habits. Suds is a tracking and awareness tool, not a drinking game: it never rewards drinking more.",
      },
    ],
  },
  {
    title: "Tracking drinks",
    items: [
      {
        q: "What can I log in Suds?",
        a: "Beer, wine, cocktails, spirits, cider and seltzer, plus water, mocktails, soft drinks and non-alcoholic drinks. Each log can include the brand, quantity, ABV, a rating, notes, photos or video, the place you were, and the friends you were with.",
      },
      {
        q: "How do I track drinks with friends?",
        a: "Follow your friends to see their drinks in your feed. Start a session for a night out and invite friends to join it, so the whole group's drinks are grouped together. You can tag friends on a drink and @mention them in notes and comments.",
      },
      {
        q: "What is a drinking session?",
        a: "A session groups the drinks from one outing, like a Friday night out. Suds shows how long it lasted, how many drinks were logged, and your pace in drinks per hour (DPH). Sessions can be shared with friends who were there.",
      },
      {
        q: "What stats does Suds track?",
        a: "Drink counts by type, your top drinks, weekly and monthly trends, which days and hours you drink most, year-over-year comparisons, drinking streaks and sober streaks, milestones, and progress against a weekly drink goal you set.",
      },
      {
        q: "Does Suds estimate BAC?",
        a: "Suds can show an approximate blood alcohol content (BAC) for an active session, based on your body details, the drinks you logged and the time that has passed. It's an estimate only, not a medical measurement. Never use it to decide whether you can drive.",
      },
      {
        q: "Can Suds help me cut back?",
        a: "It can help you see your habits clearly. Set a weekly drink goal, watch your sober streak, and log water between drinks. Suds isn't a treatment program; if you're worried about your drinking, talk to a doctor or call the SAMHSA National Helpline at 1-800-662-4357 (US).",
      },
    ],
  },
  {
    title: "Compared with other apps",
    items: [
      {
        q: "How is Suds different from Untappd?",
        a: "Untappd is built around beer check-ins and rating beers and breweries. Suds tracks every kind of drink and focuses on the night and the people rather than the beer: sessions with drinks-per-hour pace, a friends feed, a shared map, streaks, goals and personal drinking stats.",
      },
      {
        q: "How is Suds different from a drink counter app?",
        a: "Most drink counters are private logs for cutting back. Suds keeps the same tracking (goals, streaks, history) and adds a social layer, so logging a drink is something you share with friends instead of a chore.",
      },
    ],
  },
  {
    title: "Privacy and pricing",
    items: [
      {
        q: "Can I keep my drinks private?",
        a: "Yes. Make your account private and only followers you approve can see your drinks. Privacy Mode hides exact street addresses, showing only a general area. You can block or report anyone, and tagged friends can remove themselves from a post.",
      },
      {
        q: "Is Suds free?",
        a: "Yes, Suds is free to download and use. During the launch period every account also gets Suds Plus, which adds advanced analytics, full history, the BAC estimate and data export.",
      },
      {
        q: "Where can I get Suds?",
        a: "Download Suds from the App Store on iPhone, or sign up on the web at drink-with-suds.com.",
      },
    ],
  },
];

const ALL_FAQS = FAQ_GROUPS.flatMap((g) => g.items);

// schema.org FAQPage markup, so search engines can show these as rich results.
const FAQ_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ALL_FAQS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});

const TITLE = "Suds FAQ: the Strava for drinking, explained";
const DESCRIPTION =
  "Answers about Suds, the social drinking app: how it works as a Strava for drinking, tracking drinks with friends, sessions, stats, privacy, and how it compares with Untappd.";

export default function FaqScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <PublicLayout contentPadded>
      <Head>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={`${WEB_ORIGIN}/faq`} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={`${WEB_ORIGIN}/faq`} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{FAQ_JSON_LD}</script>
      </Head>

      <View style={{ marginBottom: 48 }}>
        <Text
          role="heading"
          aria-level={1}
          className={`text-4xl font-bold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}
        >
          Frequently asked questions
        </Text>
        <Text className={`text-base ${isDark ? "text-gray-400" : "text-gray-500"}`} style={{ lineHeight: 26 }}>
          Suds is the social drink tracker: Strava for drinking. Here's how it works.
        </Text>
      </View>

      {FAQ_GROUPS.map((group) => (
        <View key={group.title} style={{ marginBottom: 40 }}>
          <Text
            role="heading"
            aria-level={2}
            className={`text-2xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}
          >
            {group.title}
          </Text>
          {group.items.map(({ q, a }) => (
            <View key={q} className={`rounded-xl p-4 mb-3 ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
              <Text
                role="heading"
                aria-level={3}
                className={`text-base font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {q}
              </Text>
              <Text className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`} style={{ lineHeight: 22 }}>
                {a}
              </Text>
            </View>
          ))}
        </View>
      ))}

      <Text className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
        Still stuck?{" "}
        <Link href="/support" className="text-primary font-semibold">
          Contact support
        </Link>
        .
      </Text>
    </PublicLayout>
  );
}
