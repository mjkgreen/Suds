import { Linking, Pressable, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import { PublicLayout } from '@/components/web/PublicLayout';

function Section({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
  return (
    <View style={{ marginBottom: 40 }}>
      <Text className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</Text>
      {children}
    </View>
  );
}

function FAQ({ q, a, isDark }: { q: string; a: string; isDark: boolean }) {
  return (
    <View
      className={`rounded-xl p-4 mb-3 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}
    >
      <Text className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{q}</Text>
      <Text className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ lineHeight: 22 }}>{a}</Text>
    </View>
  );
}

function ContactCard({ icon, label, value, onPress, isDark }: {
  icon: string;
  label: string;
  value: string;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-xl p-5 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}
      style={{ flex: 1, minWidth: 200 }}
    >
      <Text style={{ fontSize: 28, marginBottom: 10 }}>{icon}</Text>
      <Text className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</Text>
      <Text className="text-primary text-sm font-medium">{value}</Text>
    </Pressable>
  );
}

const FAQS = [
  {
    q: 'How do I log a drink?',
    a: 'Tap the amber "+" button in the center of the bottom tab bar (or the + button in the top nav on web). Select your drink type, enter the name and quantity, and optionally add a location, rating, or notes. Tap Save to log it.',
  },
  {
    q: 'What is the BAC estimate?',
    a: 'Suds calculates an approximate blood alcohol content (BAC) based on your weight, age, gender, drinks logged, and time elapsed. It is an estimate only — not a medical measurement. Never use it to determine whether you can drive safely.',
  },
  {
    q: 'How do I follow someone?',
    a: 'Go to the Search tab, search for a username, tap their profile, then tap the Follow button. Once they accept (or if following is open), their drinks will appear in your feed.',
  },
  {
    q: 'What is a drinking session?',
    a: 'A session groups drinks logged during a single outing. You can start a session manually from the Log screen, or Suds will auto-group consecutive drinks. Sessions show duration, total drinks, and drinks-per-hour (DPH).',
  },
  {
    q: 'What is Privacy Mode?',
    a: 'Privacy Mode hides your exact location (street address) from other users on the map and in your feed. Only a general area is shown. You can toggle it in Settings → Privacy.',
  },
  {
    q: 'What do I get with Suds Premium?',
    a: 'Premium unlocks advanced stats (weekly/monthly analytics, goal tracking), detailed BAC history, unlimited badge slots, and early access to new features. Subscribe in the app or tap your profile.',
  },
  {
    q: 'How do I edit or delete a drink log?',
    a: 'Open the drink detail by tapping a drink in your feed or profile. Tap the edit (pencil) icon to modify it, or scroll to the bottom to find the Delete option.',
  },
  {
    q: 'Why isn\'t my location showing up?',
    a: 'Suds needs location permission to tag drinks with a place. Go to your phone\'s Settings → Suds → Location and set it to "While Using." Make sure you\'ve also enabled location in the Log screen before saving.',
  },
];

export default function SupportScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleEmailSupport = () => Linking.openURL('mailto:support@sudsapp.com?subject=Suds%20Support');
  const handleBugReport = () => Linking.openURL('mailto:support@sudsapp.com?subject=Bug%20Report&body=App%20version%3A%0ADevice%3A%0AOS%20version%3A%0A%0ASteps%20to%20reproduce%3A%0A1.%20%0A2.%20%0A%0AExpected%3A%0AActual%3A');

  return (
    <PublicLayout>
      {/* Header */}
      <View style={{ marginBottom: 48 }}>
        <Text className={`text-4xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Support
        </Text>
        <Text className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          We're here to help. Reach out or browse the FAQ below.
        </Text>
      </View>

      {/* Contact */}
      <Section title="Get in Touch" isDark={isDark}>
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          <ContactCard
            icon="✉️"
            label="Email Support"
            value="support@sudsapp.com"
            onPress={handleEmailSupport}
            isDark={isDark}
          />
          <ContactCard
            icon="🐛"
            label="Report a Bug"
            value="Send bug report"
            onPress={handleBugReport}
            isDark={isDark}
          />
        </View>
        <Text className={`text-xs mt-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          We typically respond within 1–2 business days.
        </Text>
      </Section>

      {/* Delete Account */}
      <Section title="Delete Your Account" isDark={isDark}>
        <View className={`rounded-xl p-5 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-red-50 border-red-100'}`}>
          <Text className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            How to permanently delete your account
          </Text>
          <Text className={`text-sm leading-relaxed mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ lineHeight: 22 }}>
            Deleting your account removes your profile, drink logs, followers, and all associated data. This action is permanent and cannot be undone.
          </Text>
          <View style={{ gap: 6 }}>
            {[
              'Open the Suds app on your iPhone.',
              'Go to your Profile tab → tap the gear icon (Settings).',
              'Scroll to the bottom and tap "Delete Account".',
              'Confirm the deletion when prompted.',
            ].map((step, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View className="bg-red-500 rounded-full items-center justify-center" style={{ width: 20, height: 20, marginTop: 2 }}>
                  <Text className="text-white text-xs font-bold">{i + 1}</Text>
                </View>
                <Text className={`text-sm flex-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} style={{ lineHeight: 22 }}>{step}</Text>
              </View>
            ))}
          </View>
          <Text className={`text-xs mt-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            Can't access the app? Email support@sudsapp.com with the subject "Delete Account" from your registered email address.
          </Text>
        </View>
      </Section>

      {/* FAQ */}
      <Section title="Frequently Asked Questions" isDark={isDark}>
        {FAQS.map((faq) => (
          <FAQ key={faq.q} q={faq.q} a={faq.a} isDark={isDark} />
        ))}
      </Section>
    </PublicLayout>
  );
}
