import { Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import Head from "expo-router/head";
import { PublicLayout } from "@/components/web/PublicLayout";

function Section({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
  return (
    <View style={{ marginBottom: 32 }}>
      <Text className={`text-xl font-bold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>{title}</Text>
      {children}
    </View>
  );
}

function Body({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <Text
      className={`text-sm leading-relaxed ${isDark ? "text-gray-400" : "text-gray-600"}`}
      style={{ lineHeight: 24 }}
    >
      {children}
    </Text>
  );
}

function BulletList({ items, isDark }: { items: string[]; isDark: boolean }) {
  return (
    <View style={{ gap: 6, marginTop: 8 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
          <Text className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>•</Text>
          <Text
            className={`text-sm leading-relaxed flex-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}
            style={{ lineHeight: 24 }}
          >
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function PrivacyScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const updated = "April 8, 2026";

  return (
    <PublicLayout>
      <Head>
        <title>Privacy Policy | Suds</title>
        <meta name="description" content="Read the Privacy Policy for the Suds drink tracking app." />
      </Head>
      {/* Header */}
      <View style={{ marginBottom: 40 }}>
        <Text className={`text-4xl font-bold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>Privacy Policy</Text>
        <Text className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>Last updated: {updated}</Text>
      </View>

      <Section title="Overview" isDark={isDark}>
        <Body isDark={isDark}>
          Suds is committed to protecting your privacy. This policy explains what data we collect, how we use it, and
          your rights. We do not sell your personal data to third parties.
        </Body>
      </Section>

      <Section title="1. Data We Collect" isDark={isDark}>
        <Body isDark={isDark}>When you use Suds, we collect:</Body>
        <BulletList
          isDark={isDark}
          items={[
            "Account information: email address, display name, username, and optional profile photo.",
            "Profile data: height, weight, date of birth — used only to calculate BAC estimates. Never visible to other users.",
            "Drink logs: what you drank, when, quantity, optional location, notes, and rating.",
            "Location data: optional, only when you choose to log a drink with location. If Privacy Mode is enabled, your exact street address is hidden from other users.",
            "Usage data: app interactions, crash reports, and performance diagnostics via Expo.",
            "Device information: device type, operating system version, and app version.",
          ]}
        />
      </Section>

      <Section title="2. How We Use Your Data" isDark={isDark}>
        <Body isDark={isDark}>We use your data to:</Body>
        <BulletList
          isDark={isDark}
          items={[
            "Operate and improve the App (feed, social features, BAC estimates, streaks, badges).",
            "Show your drink history and statistics to you.",
            "Enable social features: sharing drink logs with followers, activity feed.",
            "Send optional notifications (e.g., session reminders).",
            "Process premium subscriptions via Apple (we do not handle payment data directly).",
            "Diagnose bugs and improve app stability.",
          ]}
        />
      </Section>

      <Section title="3. Data Sharing" isDark={isDark}>
        <Body isDark={isDark}>
          We do not sell your personal data. We share data only in these limited circumstances:
        </Body>
        <BulletList
          isDark={isDark}
          items={[
            "With Supabase (our database and authentication provider) to store and retrieve your data securely.",
            "With RevenueCat to manage premium subscription status.",
            "With other users: your public profile, username, and drink logs you choose to share are visible to your followers. You control your privacy settings.",
            "If required by law or to protect the rights and safety of users.",
          ]}
        />
      </Section>

      <Section title="4. Data Storage & Security" isDark={isDark}>
        <Body isDark={isDark}>
          Your data is stored on Supabase infrastructure with industry-standard encryption in transit and at rest. We
          apply row-level security policies to ensure you can only access your own data and data explicitly shared with
          you by other users. We regularly review our security practices.
        </Body>
      </Section>

      <Section title="5. Location & Privacy Mode" isDark={isDark}>
        <Body isDark={isDark}>
          Location is always optional. When you log a drink with location, the coordinates are stored and may appear on
          the social map. Enabling Privacy Mode hides your exact address from other users — only a general area is
          shown. You can disable location sharing at any time in your device settings or within the app.
        </Body>
      </Section>

      <Section title="6. Data Retention" isDark={isDark}>
        <Body isDark={isDark}>
          We retain your data as long as your account is active. If you delete your account, your profile and drink logs
          are permanently deleted within 30 days, except where required by law to retain them longer.
        </Body>
      </Section>

      <Section title="7. Your Rights" isDark={isDark}>
        <Body isDark={isDark}>You have the right to:</Body>
        <BulletList
          isDark={isDark}
          items={[
            "Access the personal data we hold about you.",
            "Correct inaccurate data via your profile settings.",
            "Delete your account and all associated data (see the Support page for instructions).",
            "Export your drink log data — contact us at suds.application@gmail.com.",
            "Opt out of non-essential communications.",
          ]}
        />
      </Section>

      <Section title="8. Children's Privacy" isDark={isDark}>
        <Body isDark={isDark}>
          Suds is not intended for use by anyone under the legal drinking age (21 in the United States). We do not
          knowingly collect data from minors. If you believe a minor has created an account, contact us and we will
          delete it promptly.
        </Body>
      </Section>

      <Section title="9. Changes to This Policy" isDark={isDark}>
        <Body isDark={isDark}>
          We may update this Privacy Policy periodically. We will notify you of significant changes through the App or
          by email. Continued use of Suds after an update means you accept the revised policy.
        </Body>
      </Section>

      <Section title="10. Contact" isDark={isDark}>
        <Body isDark={isDark}>Privacy questions or data requests? Email us at suds.application@gmail.com.</Body>
      </Section>
    </PublicLayout>
  );
}
