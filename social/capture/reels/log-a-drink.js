// Reel: log a drink -> it lands in the feed -> weekly limit on your profile.
// Usage: node log-a-drink.js <outDir>
const { openApp } = require('../lib');
const { Recorder } = require('../recorder');

const HOOK = process.env.HOOK || 'Your night out,\nlogged in 5 seconds';

(async () => {
  const out = process.argv[2];
  const { browser, page } = await openApp({ route: '/feed', width: 540, height: 1021, scale: 3,
    beforeLoad: Recorder.installClock });
  const rec = new Recorder(page, out);
  const text = async (t) => {
    const el = await rec.onTop(t);
    if (!el) throw new Error(`"${t}" not on screen`);
    return el;
  };
  await page.waitForSelector('text=Maya Chen', { timeout: 120000 });
  await rec.settle(2000);

  // 1. Hook over the live feed.
  rec.cut('feed');
  rec.setOverlay({ text: HOOK, style: 'hook' });
  rec.setCamera({ cx: 270, cy: 560, z: 1.0 });
  await rec.shoot(20);
  rec.setCamera({ cy: 640, z: 1.03 });
  await rec.scrollBy(330, 70);
  await rec.shoot(15);

  // 2. Log a drink (cut in on the form; the + lives in the web-only top bar).
  await page.mouse.wheel(0, -5000);            // off camera: feed back to the top
  await rec.settle(500);
  await page.mouse.click(453, 30);
  await page.waitForSelector('text=Log a Drink');
  await rec.settle(1500);
  rec.cut('log');
  rec.setOverlay({ text: 'Tap. Type. Done.', style: 'caption' });
  rec.setCamera({ cx: 270, cy: 420, z: 1.0 });
  await rec.shoot(10);
  await rec.focus(await text('Cocktail'), 1.04);
  await rec.shoot(12);
  await rec.tap(await text('Cocktail'));
  await rec.shoot(12);
  const name = page.getByPlaceholder('e.g. IPA, Old Fashioned');
  await rec.focus(name, 1.04, -30);
  await rec.shoot(8);
  await rec.type(name, 'Espr', 3);
  await rec.shoot(8);
  const suggestion = await rec.onTop('Espresso Martini');
  if (suggestion) await rec.tap(suggestion);
  else await rec.type(name, 'esso Martini', 2);
  await rec.shoot(14);
  await rec.focus(await text('Location (optional)'), 1.04, 40);
  await rec.shoot(24);
  const logIt = await text('Log It');
  await rec.focus(logIt, 1.04, -150);
  await rec.shoot(10);
  await rec.tap(logIt);

  // 3. It lands at the top of the feed.
  rec.setOverlay({ text: 'Your crew sees it\nright away', style: 'caption', at: 'above-focus' });
  let mine = null;
  await rec.shootUntil(async () => !!(mine = await rec.onTop('Jordan Reyes')), 90);
  rec.cut('posted');
  await rec.focus(mine, 1.04, 110);
  await rec.shoot(60);

  // 4. Profile: weekly limit and history.
  await page.mouse.click(497, 30);             // avatar menu (web-only bar) -> Profile
  await rec.settle(500);
  const menuItem = (await rec.onTop('Profile')) || (await rec.onTop('View Profile'));
  if (menuItem) await menuItem.click();
  await page.waitForSelector('text=WEEKLY LIMIT, text=Weekly Limit', { timeout: 30000 }).catch(() => {});
  await rec.settle(1500);
  rec.cut('profile');
  rec.setOverlay({ text: 'Know your limits', style: 'caption', at: 'above-focus' });
  await rec.focus(await rec.onTop(/weekly limit/i, { exact: false }), 1.04, 30);
  await rec.shoot(40);
  rec.setCamera({ cx: 270, cy: 600, z: 1.0 });
  await rec.scrollBy(380, 50);
  await rec.shoot(25);

  rec.save({ reel: 'log-a-drink', hook: HOOK });
  await browser.close();
  console.log(`${rec.frames.length} frames -> ${out}`);
})().catch((e) => { console.error(e); process.exit(1); });
