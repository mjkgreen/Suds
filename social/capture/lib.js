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

// This run's scenario (backend/scenario.py): cast, venues, nights out, drinks.
const SCENARIO = JSON.parse(require('child_process').execFileSync('python3',
  [require('path').join(__dirname, '..', 'backend', 'scenario.py'), 'json'], { encoding: 'utf8' }));
const PLACES = SCENARIO.venues;

async function openApp({ width = 540, height = 960, scale = 2, route = '/feed', beforeLoad } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale,
    isMobile: false, hasTouch: false, colorScheme: 'light', timezoneId: eveningTimezone(),
    geolocation: { latitude: PLACES[SCENARIO.log.venue].lat, longitude: PLACES[SCENARIO.log.venue].lng }, permissions: ['geolocation'] });
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
    const place = (p) => ({ place_id: PLACES.indexOf(p) + 1, name: p.name, display_name: `${p.name}, ${p.street}, ${SCENARIO.city}`,
      lat: String(p.lat), lon: String(p.lng), address: { amenity: p.name, road: p.street, city: SCENARIO.city } });
    if (u.pathname.startsWith('/reverse')) {
      const lat = +u.searchParams.get('lat'), lng = +u.searchParams.get('lon');
      const near = PLACES.slice().sort((a, b) => Math.hypot(a.lat - lat, a.lng - lng) - Math.hypot(b.lat - lat, b.lng - lng))[0];
      return route.fulfill({ json: place(near) });
    }
    const q = (u.searchParams.get('q') || '').toLowerCase();
    return route.fulfill({ json: PLACES.filter((p) => p.name.toLowerCase().includes(q)).map(place) });
  });
  // Since 1.7.x the web app searches and suggests venues with Photon (photon.komoot.io).
  // Answer it from the same fictional venues, nearest first.
  await context.route('https://photon.komoot.io/**', (route) => {
    const u = new URL(route.request().url());
    const lat = +u.searchParams.get('lat'), lng = +u.searchParams.get('lon');
    const feature = (p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { osm_id: PLACES.indexOf(p) + 1, osm_type: 'N', osm_key: 'amenity', osm_value: 'bar', type: 'house',
        name: p.name, street: p.street, city: SCENARIO.city } });
    const near = (a) => (Number.isFinite(lat) ? Math.hypot(a.lat - lat, a.lng - lng) : 0);
    let hits = PLACES.slice().sort((a, b) => near(a) - near(b));
    if (u.pathname.startsWith('/api')) {
      const q = (u.searchParams.get('q') || '').toLowerCase();
      hits = hits.filter((p) => p.name.toLowerCase().includes(q));
    } else {
      hits = hits.filter((p) => near(p) < 0.004);   // ~400 m: "where are you?"
    }
    return route.fulfill({ json: { type: 'FeatureCollection', features: hits.slice(0, 10).map(feature) } });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message.slice(0, 200)));
  if (beforeLoad) await beforeLoad(page);
  await page.goto(APP + route, { timeout: 300000 });
  return { browser, context, page };
}
module.exports = { openApp, APP, eveningTimezone, SCENARIO };
