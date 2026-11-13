import { Text, View } from "react-native";
import { Link } from "expo-router";

interface HelpContact {
  label: string;
  href: `https://${string}` | `tel:${string}`;
}

interface HelpResource {
  name: string;
  where: string;
  detail: string;
  contacts: HelpContact[];
}

// Free, confidential services for people worried about their own or someone
// else's drinking. Check numbers and links still work before each release.
const HELP_RESOURCES: HelpResource[] = [
  {
    name: "Find A Helpline",
    where: "Worldwide",
    detail: "A directory of free, confidential helplines in over 130 countries. Search by country and topic, including alcohol and drugs.",
    contacts: [{ label: "findahelpline.com", href: "https://findahelpline.com" }],
  },
  {
    name: "SAMHSA National Helpline",
    where: "United States",
    detail: "Free, confidential treatment referral and information, 24 hours a day, in English and Spanish.",
    contacts: [
      { label: "1-800-662-4357", href: "tel:18006624357" },
      { label: "findtreatment.gov", href: "https://findtreatment.gov" },
    ],
  },
  {
    name: "988 Suicide & Crisis Lifeline",
    where: "United States and Canada",
    detail: "Call or text any time if you or someone you know is in crisis, including over drinking or drug use.",
    contacts: [{ label: "988", href: "tel:988" }],
  },
  {
    name: "Drinkline",
    where: "United Kingdom",
    detail: "Free, confidential advice about your own or someone else's drinking.",
    contacts: [{ label: "0300 123 1110", href: "tel:03001231110" }],
  },
  {
    name: "HSE Drugs and Alcohol Helpline",
    where: "Ireland",
    detail: "Free, confidential support and information.",
    contacts: [{ label: "1800 459 459", href: "tel:1800459459" }],
  },
  {
    name: "National Alcohol and Other Drug Hotline",
    where: "Australia",
    detail: "Free, confidential advice 24 hours a day, connecting you to your state or territory service.",
    contacts: [{ label: "1800 250 015", href: "tel:1800250015" }],
  },
  {
    name: "Alcohol Drug Helpline",
    where: "New Zealand",
    detail: "Free, confidential support 24 hours a day by phone or text.",
    contacts: [{ label: "0800 787 797", href: "tel:0800787797" }],
  },
  {
    name: "Alcoholics Anonymous",
    where: "Worldwide",
    detail: "Find free in-person and online meetings near you.",
    contacts: [{ label: "aa.org", href: "https://www.aa.org/find-aa" }],
  },
  {
    name: "Al-Anon",
    where: "Worldwide",
    detail: "Support for family and friends of someone whose drinking worries them.",
    contacts: [{ label: "al-anon.org", href: "https://al-anon.org/al-anon-meetings/" }],
  },
];

interface HelpResourcesProps {
  isDark: boolean;
}

export function HelpResources({ isDark }: HelpResourcesProps) {
  const headingColor = isDark ? "text-white" : "text-gray-900";
  const bodyColor = isDark ? "text-gray-400" : "text-gray-600";

  return (
    <View style={{ marginBottom: 40 }}>
      <Text role="heading" aria-level={2} className={`text-3xl font-bold mb-3 ${headingColor}`}>
        Getting help
      </Text>
      <Text className={`text-base mb-2 ${bodyColor}`} style={{ lineHeight: 26 }}>
        Suds is a tracker, not a treatment program. If you're worried about your drinking, or someone else's, talk to a
        doctor or contact one of these free, confidential services.
      </Text>
      <Text className={`text-base font-semibold mb-6 ${headingColor}`} style={{ lineHeight: 26 }}>
        If someone is in immediate danger, for example with signs of alcohol poisoning, call your local emergency
        number.
      </Text>

      {HELP_RESOURCES.map((resource) => (
        <View key={resource.name} className={`rounded-xl p-4 mb-3 ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
          <Text className={`text-xs font-semibold uppercase mb-1 ${bodyColor}`}>{resource.where}</Text>
          <Text role="heading" aria-level={3} className={`text-base font-semibold mb-2 ${headingColor}`}>
            {resource.name}
          </Text>
          <Text className={`text-sm mb-2 ${bodyColor}`} style={{ lineHeight: 22 }}>
            {resource.detail}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 4 }}>
            {resource.contacts.map((contact) => (
              <Link key={contact.href} href={contact.href} className="text-primary font-semibold text-sm">
                {contact.label}
              </Link>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
