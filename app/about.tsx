import { Text, View } from "react-native";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { useColorScheme } from "nativewind";
import { PublicLayout } from "@/components/web/PublicLayout";
import { HelpResources } from "@/components/web/HelpResources";
import { WEB_ORIGIN } from "@/lib/share";

// Written as the questions people ask search engines and AI assistants, so
// each answer can be quoted on its own. Keep every answer true to what the app
// does today, and keep competitor descriptions fair and current.
const FAQ_GROUPS: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: "The basics",
    items: [
      {
        q: "What is Suds?",
        a: "Suds is a social drink tracker. You log each drink, follow your friends, and see everyone's nights out in a shared feed, while your profile builds up stats, streaks and milestones from your own drinking history. It's available on iPhone and on the web.",
      },
      {
        q: "What is a social drink tracker?",
        a: "A drink tracker you share with friends instead of keeping to yourself. In Suds, friends can like and comment on your drinks, tag each other, join the same session on a night out, and see where the group has been on a shared map. You still get the private side too: your own history, stats and goals.",
      },
      {
        q: "Is there a Strava for drinking?",
        a: "Suds is the closest thing to it. Strava turned workouts into something you log, share with friends and look back on; Suds does the same for drinks. Each drink is an activity in your feed, a night out becomes a session with a duration and a pace, and your profile keeps the record.",
      },
      {
        q: "Who is Suds for?",
        a: "Adults of legal drinking age (21 or older in the United States) who want to remember their nights out, keep up with friends, and understand their own drinking habits. Suds is a tracking and awareness tool, not a drinking game: it never rewards drinking more.",
      },
    ],
  },
  {
    title: "Why track your drinks",
    items: [
      {
        q: "What are the benefits of tracking your drinks?",
        a: "Most people underestimate how much they drink, because a night out blurs together and nobody remembers last month. A log gives you real numbers: how many drinks a week, which nights run longest, how fast you drink once you're out. That makes it easier to notice patterns and set limits you'll actually keep. Additionally, you'll get actual data on how many drinks you have, which can help you make more informed decisions about your drinking habits.",
      },
      {
        q: "Why track drinks with friends instead of on your own?",
        a: "Private logs are easy to abandon. Sharing makes logging part of the night: friends see your drinks, react to them, and log their own, so the habit sticks. You also end up with a shared record of the night (who was there, where you went, what everyone had) that's more fun to look back on than a spreadsheet.",
      },
      {
        q: "Does tracking your drinks help you drink less?",
        a: "Seeing your numbers helps you stay within limits you choose. In Suds you can set a weekly drink goal, watch your pace in drinks per hour, keep a sober streak, and log water between rounds. Suds isn't a treatment program; if you're worried about your drinking, talk to a doctor or contact a free, confidential helpline. In the US, call the SAMHSA National Helpline at 1-800-662-4357; elsewhere, findahelpline.com lists free services by country. More resources are under Getting help on this page.",
      },
      {
        q: "What can I log in Suds?",
        a: "Beer, wine, cocktails, spirits, cider and seltzer, plus water, mocktails, soft drinks and non-alcoholic drinks. Each log can include the brand, quantity, ABV, a rating, notes, photos or video, the place you were, and the friends you were with.",
      },
      {
        q: "What is a drinking session?",
        a: "A session groups the drinks from one outing, like a Friday night out. Suds shows how long it lasted, how many drinks were logged, and your pace in drinks per hour (DPH). Friends can join the same session so the whole group's night is in one place.",
      },
      {
        q: "What stats does Suds track?",
        a: "Drink counts by type, your top drinks, weekly and monthly trends, which days and hours you drink most, year-over-year comparisons, drinking streaks and sober streaks, milestones, and progress against your weekly drink goal.",
      },
      {
        q: "Does Suds estimate BAC?",
        a: "Suds can show an approximate blood alcohol content (BAC) for an active session, based on your body details, the drinks you logged and the time that has passed. It's an estimate only, not a medical measurement. Never use it to decide whether you can drive.",
      },
    ],
  },
  {
    title: "Suds compared with other apps",
    items: [
      {
        q: "How is Suds different from Untappd?",
        a: "Untappd is built for beer: you check in beers, rate them, and follow breweries and venues. Suds covers every drink, not just beer, and is about the night and the people rather than the beer itself: sessions with a pace, a friends feed, a shared map, streaks, goals and personal drinking stats. If you mostly want to rate craft beer, Untappd is the better fit; if you want to track your whole night with friends, use Suds.",
      },
      {
        q: "How is Suds different from Vivino?",
        a: "Vivino is for wine: scanning labels, reading ratings and buying bottles. Suds isn't a wine guide. It tracks what you actually drink (wine included) across a night out, with friends, and turns it into stats and history.",
      },
      {
        q: "How is Suds different from Distiller?",
        a: "Distiller is a spirits review app for discovering and rating whiskey, gin, rum and so on. Suds logs the drinks you have and who you had them with, rather than reviewing bottles.",
      },
      {
        q: "How is Suds different from Sunnyside, Reframe or other cut-back apps?",
        a: "Apps like Sunnyside and Reframe are built to help you drink less, with plans, coaching or lessons. Suds isn't a reduction program: it's a social tracker for people who want to drink responsibly and stay aware of it. It does include goals, sober streaks and pace tracking, but there's no coaching or curriculum.",
      },
      {
        q: "How is Suds different from a private drink counter?",
        a: "Drink counters and alcohol diaries are private logs. Suds keeps that tracking (history, goals, streaks) and adds friends, a feed, shared sessions and a map, so logging a drink feels like part of the night rather than a chore.",
      },
      {
        q: "What's the best app for tracking drinks with friends?",
        a: "It depends what you want. For rating beer, Untappd; for wine, Vivino; for cutting back with coaching, a program like Sunnyside or Reframe. For logging every kind of drink, sharing nights out with friends, and seeing your own stats and pace, Suds is built for exactly that.",
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

const TITLE = "About Suds: the social drink tracker, and how it compares";
const DESCRIPTION =
  "What Suds is, why track your drinks with friends, and answers to common questions, including how Suds compares with Untappd, Vivino, Distiller, Sunnyside and Reframe.";

export default function AboutScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <PublicLayout contentPadded>
      <Head>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={`${WEB_ORIGIN}/about`} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={`${WEB_ORIGIN}/about`} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{FAQ_JSON_LD}</script>
      </Head>

      <View style={{ marginBottom: 48 }}>
        <Text
          role="heading"
          aria-level={1}
          className={`text-4xl font-bold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}
        >
          About Suds
        </Text>
        <Text className={`text-base mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`} style={{ lineHeight: 26 }}>
          Suds is a social drink tracker. You log what you drink, your friends see it and log theirs, and a night out
          becomes a session with a length and a pace. Over time your profile turns into a real picture of how much you
          drink, not a guess.
        </Text>
        <Text className={`text-base mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`} style={{ lineHeight: 26 }}>
          Private drink logs are easy to forget about. Doing it with friends makes logging part of the night, and leaves
          you with a shared record of who was there, where you went and what everyone had.
        </Text>
        <Text className={`text-base ${isDark ? "text-gray-400" : "text-gray-600"}`} style={{ lineHeight: 26 }}>
          It's built for awareness, and can help you drink more mindfully: set a weekly goal, keep a sober streak, log
          water between rounds, and make your account private whenever you want.
        </Text>
      </View>

      <Text
        role="heading"
        aria-level={2}
        className={`text-3xl font-bold mb-6 ${isDark ? "text-white" : "text-gray-900"}`}
      >
        Frequently asked questions
      </Text>

      {FAQ_GROUPS.map((group) => (
        <View key={group.title} style={{ marginBottom: 40 }}>
          <Text
            role="heading"
            aria-level={3}
            className={`text-xl font-bold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}
          >
            {group.title}
          </Text>
          {group.items.map(({ q, a }) => (
            <View key={q} className={`rounded-xl p-4 mb-3 ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
              <Text
                role="heading"
                aria-level={4}
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

      <HelpResources isDark={isDark} />

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
