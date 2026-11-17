// Shared Playwright helpers: open the real app, signed in as the demo user.
const { chromium } = require('playwright');
const path = require('path');
const { tokens, DEMO_USER } = require('../backend/tokens');

const APP = process.env.SUDS_APP_URL || 'http://localhost:8081';

// The seed's times are relative to the real clock, so pick the fixed-offset
// timezone in which it is currently about 9 pm: posts always read as an evening.
function eveningTimezone(targetHour = 21) {
  const utcH = new Date().getUTCHours();
  let off = ((targetHour - utcH + 36) % 24) - 12; // -12..11
  if (off < -12) off += 24; if (off > 14) off -= 24;
  return off === 0 ? 'Etc/GMT' : `Etc/GMT${off > 0 ? '-' : '+'}${Math.abs(off)}`; // POSIX sign is inverted
}

// Mirrors the venues in backend/seed.sql.
const PLACES = [
  { name: 'The Copper Tap', street: 'Wynkoop Street', lat: 39.7527, lng: -104.9997 },
  { name: 'Larkspur Wine Bar', street: 'Grant Street', lat: 39.7392, lng: -104.9849 },
  { name: 'Half Moon Brewing', street: 'Larimer Street', lat: 39.7621, lng: -104.981 },
  { name: 'Ridgeline Taproom', street: 'South Pearl Street', lat: 39.685, lng: -104.98 },
  { name: 'Juniper & Rye', street: 'Blake Street', lat: 39.7469, lng: -104.992 },
  { name: 'Sunset Rooftop', street: '16th Street', lat: 39.7505, lng: -105.0004 },
  { name: 'Mile High Cider House', street: 'Brighton Boulevard', lat: 39.768, lng: -104.973 },
  { name: 'Lantern Room', street: 'Tennyson Street', lat: 39.7765, lng: -105.0435 },
  { name: 'Bluebird Social', street: 'Colfax Avenue', lat: 39.7402, lng: -104.961 },
  { name: 'Hollow Oak Pub', street: 'South Broadway', lat: 39.711, lng: -104.9875 },
  { name: 'Parkside Beer Garden', street: 'York Street', lat: 39.747, lng: -104.953 },
  { name: 'The Low Ceiling', street: 'Navajo Street', lat: 39.7745, lng: -105.0055 },
  { name: 'Saltwater Oyster Bar', street: 'Fillmore Street', lat: 39.7195, lng: -104.9535 },
  { name: 'Second Story Lounge', street: '32nd Avenue', lat: 39.762, lng: -105.011 },
  { name: 'Lakeview Patio', street: 'Sheridan Boulevard', lat: 39.75, lng: -105.045 },
  { name: 'Gilded Fox', street: 'Pearl Street', lat: 39.733, lng: -104.98 },
  { name: 'Brick & Barrel', street: 'Walnut Street', lat: 39.76, lng: -104.987 },
  { name: 'Willow Wine Co.', street: 'Old South Gaylord', lat: 39.699, lng: -104.961 },
  { name: 'Fieldhouse Taps', street: 'Blake Street', lat: 39.756, lng: -104.994 },
  { name: 'Night Owl Bar', street: 'Santa Fe Drive', lat: 39.727, lng: -104.999 },
];

async function openApp({ width = 540, height = 960, scale = 2, route = '/feed', beforeLoad } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale,
    isMobile: false, hasTouch: false, colorScheme: 'light', timezoneId: eveningTimezone(),
    geolocation: { latitude: 39.7527, longitude: -104.9997 }, permissions: ['geolocation'] });
  const session = { access_token: tokens.user, token_type: 'bearer', expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: 'demo-refresh', user: DEMO_USER };
  await context.addInitScript(([s, uid]) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(s));
    localStorage.setItem('suds-age-check:' + uid, JSON.stringify({ allowed: true, checkedAt: Date.now() }));
  }, [session, DEMO_USER.id]);
  // Safety net: captures must never reach the production backend.
  await context.route(/\.supabase\.(co|in)\//, (route) => {
    console.error('blocked production request:', route.request().url());
    return route.abort();
  });
  // The app geocodes with OpenStreetMap Nominatim. Captures answer from the
  // seed's fictional venues instead (no real businesses, no external calls).
  await context.route('https://nominatim.openstreetmap.org/**', (route) => {
    const u = new URL(route.request().url());
    const place = (p) => ({ place_id: PLACES.indexOf(p) + 1, name: p.name, display_name: `${p.name}, ${p.street}, Denver, Colorado`,
      lat: String(p.lat), lon: String(p.lng), address: { amenity: p.name, road: p.street, city: 'Denver', state: 'Colorado', country: 'United States', country_code: 'us' } });
    if (u.pathname.startsWith('/reverse')) {
      const lat = +u.searchParams.get('lat'), lng = +u.searchParams.get('lon');
      const near = PLACES.slice().sort((a, b) => Math.hypot(a.lat - lat, a.lng - lng) - Math.hypot(b.lat - lat, b.lng - lng))[0];
      return route.fulfill({ json: place(near) });
    }
    const q = (u.searchParams.get('q') || '').toLowerCase();
    return route.fulfill({ json: PLACES.filter((p) => p.name.toLowerCase().includes(q)).map(place) });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message.slice(0, 200)));
  if (beforeLoad) await beforeLoad(page);
  await page.goto(APP + route, { timeout: 300000 });
  return { browser, context, page };
}
module.exports = { openApp, APP, eveningTimezone };
