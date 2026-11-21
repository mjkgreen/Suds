import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

/** Where the bar sends people: the /app redirect (vercel.json) picks the right store. */
const GET_APP_HREF = '/app?c=web_bar';
const DISMISS_KEY = 'suds-get-app-bar-dismissed';
const DISMISS_DAYS = 14;

/**
 * Phones where Apple's Smart App Banner can't appear: in-app browsers
 * (Instagram, Facebook, TikTok, Snapchat, X, LinkedIn…), Chrome/Firefox/Edge on
 * iOS, and Android. iPhone Safari gets Apple's own banner (app/+html.tsx) instead.
 */
export function wantsGetAppBar(ua: string): boolean {
  const phone = /iPhone|iPod|Android/i.test(ua);
  if (!phone) return false;
  const inAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|musical_ly|BytedanceWebview|TikTok|Snapchat|Twitter|LinkedInApp|Line\/|Pinterest/i.test(ua);
  const otherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  const android = /Android/i.test(ua);
  return inAppBrowser || otherIosBrowser || android;
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

/** A small "Get the app" bar pinned to the bottom of the page on those phones. Web only. */
export function GetAppBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    setShow(wantsGetAppBar(navigator.userAgent) && !dismissedRecently());
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
    setShow(false);
  };

  return (
    <View
      accessibilityRole="banner"
      style={{
        position: 'fixed' as never, left: 12, right: 12, bottom: 12, zIndex: 10000,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 10, paddingLeft: 10, paddingRight: 8,
        backgroundColor: '#111827', borderRadius: 18,
        shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
        marginBottom: 'env(safe-area-inset-bottom)' as never,
      }}
    >
      <Image source={require('../../../assets/Suds.png')} style={{ width: 40, height: 40, borderRadius: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Suds is better in the app</Text>
        <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>Free · log drinks with your crew</Text>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Get the Suds app"
        onPress={() => { window.location.href = GET_APP_HREF; }}
        style={{ backgroundColor: '#f59e0b', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 }}
      >
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Get</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={dismiss} hitSlop={10} style={{ padding: 4 }}>
        <Ionicons name="close" size={20} color="#9ca3af" />
      </Pressable>
    </View>
  );
}
