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

export default function TermsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const updated = "April 8, 2026";

  return (
    <PublicLayout>
      <Head>
        <title>Terms of Service | Suds</title>
        <meta name="description" content="Read the Terms of Service for the Suds drink tracking app." />
      </Head>
      {/* Header */}
      <View style={{ marginBottom: 40 }}>
        <Text className={`text-4xl font-bold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>Terms of Service</Text>
        <Text className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>Last updated: {updated}</Text>
      </View>

      <Section title="1. Acceptance of Terms" isDark={isDark}>
        <Body isDark={isDark}>
          By downloading, installing, or using the Suds app ("App") or visiting this website, you agree to be bound by
          these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.
        </Body>
      </Section>

      <Section title="2. Age Requirement" isDark={isDark}>
        <Body isDark={isDark}>
          You must be of legal drinking age in your jurisdiction (21 years or older in the United States) to use Suds.
          By creating an account, you confirm that you meet this age requirement. We reserve the right to terminate
          accounts that we reasonably believe belong to underage users.
        </Body>
      </Section>

      <Section title="3. Responsible Use" isDark={isDark}>
        <Body isDark={isDark}>
          Suds is a drink-tracking and social tool. The BAC (blood alcohol content) estimates provided by the App are
          approximations only and are not medically accurate. Never use Suds estimates to determine whether you are safe
          to drive or operate heavy machinery. Always drink responsibly. Suds is not liable for any actions you take
          based on information displayed in the App.
        </Body>
      </Section>

      <Section title="4. Your Account" isDark={isDark}>
        <Body isDark={isDark}>
          You are responsible for maintaining the confidentiality of your account credentials and for all activities
          that occur under your account. You agree to notify us immediately of any unauthorized use. You may not share
          your account with others or create accounts for third parties without their consent.
        </Body>
      </Section>

      <Section title="5. Premium Subscriptions" isDark={isDark}>
        <Body isDark={isDark}>
          Suds offers optional premium features via in-app purchases processed by Apple. Subscriptions automatically
          renew unless cancelled at least 24 hours before the end of the current period. You can manage or cancel
          subscriptions in your Apple ID account settings. We do not offer refunds for partial subscription periods
          except as required by law.
        </Body>
      </Section>

      <Section title="6. User Content" isDark={isDark}>
        <Body isDark={isDark}>
          You retain ownership of content you submit (drink logs, profile info, notes). By submitting content, you grant
          Suds a limited license to display and process that content to operate the App. You are solely responsible for
          your content and must not post anything unlawful, harmful, or that violates others' rights.
        </Body>
      </Section>

      <Section title="7. Prohibited Use" isDark={isDark}>
        <Body isDark={isDark}>
          You agree not to: (a) use the App to promote irresponsible drinking or harm to others; (b) scrape,
          reverse-engineer, or attempt to access our systems without authorization; (c) use the App to harass, stalk, or
          threaten other users; (d) create fake accounts or misrepresent your identity; (e) violate any applicable laws
          or regulations.
        </Body>
      </Section>

      <Section title="8. Disclaimers" isDark={isDark}>
        <Body isDark={isDark}>
          THE APP IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT WARRANT THAT THE APP WILL BE
          UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS. BAC ESTIMATES ARE FOR INFORMATIONAL PURPOSES ONLY
          AND SHOULD NOT BE RELIED UPON FOR SAFETY DECISIONS.
        </Body>
      </Section>

      <Section title="9. Limitation of Liability" isDark={isDark}>
        <Body isDark={isDark}>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, SUDS AND ITS DEVELOPERS SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE APP.
        </Body>
      </Section>

      <Section title="10. Governing Law" isDark={isDark}>
        <Body isDark={isDark}>
          These Terms are governed by the laws of the United States. Any disputes shall be resolved through binding
          arbitration in accordance with applicable arbitration rules, except that either party may seek injunctive
          relief in a court of competent jurisdiction.
        </Body>
      </Section>

      <Section title="11. Changes to These Terms" isDark={isDark}>
        <Body isDark={isDark}>
          We may update these Terms from time to time. We will notify you of material changes via the App or email.
          Continued use of the App after changes take effect constitutes acceptance of the updated Terms.
        </Body>
      </Section>

      <Section title="12. Contact" isDark={isDark}>
        <Body isDark={isDark}>Questions about these Terms? Contact us at suds.application@gmail.com.</Body>
      </Section>
    </PublicLayout>
  );
}
