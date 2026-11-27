// The map: where you and your friends have been, clustered, with routes.
module.exports = {
  about: 'The map shows everywhere you and friends logged drinks, clustered, with night-out routes.',
  startRoute: '/map',
  readyText: 'My Drinks',
  defaults: {
    hook: 'Every bar you\'ve been to,\non one map',
    captions: ['Your spots', 'Your friends\' spots too', 'Tap a spot,\nrelive the night'],
    headline: 'Every spot,\non one map',
  },
  async reel({ rec, page, on, caption, copy, waitFor }) {
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 60000 });
    await rec.settle(2500);
    await page.waitForTimeout(1500);
    // The marker with the biggest count is where the action is.
    const busiest = async () => {
      const boxes = await page.locator('.leaflet-marker-icon').evaluateAll((els) => els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, n: parseInt(e.textContent, 10) || 1 };
      }));
      return boxes.filter((b) => b.y > 120 && b.y < 960 && b.x > 30 && b.x < 510).sort((a, b) => b.n - a.n)[0];
    };
    rec.cut('city');
    rec.setOverlay({ text: copy.hook, style: 'hook' });
    rec.setCamera({ cx: 270, cy: 541, z: 1.0 });
    await rec.shoot(25);
    let hot = await busiest();
    rec.setCamera({ cx: hot ? hot.x : 270, cy: hot ? hot.y : 560, z: 1.25 });
    await rec.shoot(75);
    rec.setOverlay(caption(0));
    await rec.shoot(30);
    rec.setOverlay(caption(1));
    rec.setCamera({ cx: 270, cy: 541, z: 1.0 });
    await rec.tap(await on('Friends'));
    await page.waitForTimeout(1500);
    await rec.shoot(55);

    // Off camera: zoom in a step so the spots spread out and are easy to tap.
    await page.mouse.move(270, 541);
    await page.mouse.wheel(0, -100); await page.waitForTimeout(1200);
    await rec.settle(1000);
    await page.waitForTimeout(2500);

    // Off camera: find a couple of spots whose popup lists some history (2+ rows).
    const pins = page.locator('.leaflet-marker-icon');
    const closePopup = async () => {
      await page.locator('.leaflet-popup-close-button').click().catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
      await rec.settle(500, 200);
    };
    const inView = (b) => b && b.y > 160 && b.y < 860 && b.x > 40 && b.x < 500;
    const found = [];
    for (let k = 0; k < Math.min(await pins.count(), 30); k++) {
      const b = await pins.nth(k).boundingBox();
      if (!inView(b)) continue;
      await pins.nth(k).click().catch(() => {});
      await rec.settle(600, 200);
      const rows = await page.locator('.leaflet-popup button[aria-label^="View "]').count();
      await closePopup();
      if (rows >= 2) found.push({ k, rows, x: b.x, y: b.y });
    }
    // Two spots, apart from each other (more history first); fall back to whatever has a popup.
    found.sort((a, b) => b.rows - a.rows);
    const spots = [];
    for (const f of found) {
      if (spots.every((s) => Math.hypot(s.x - f.x, s.y - f.y) > 30)) spots.push(f);
      if (spots.length === 2) break;
    }

    rec.cut('spots');
    rec.setOverlay(caption(2));
    rec.setCamera({ cx: 270, cy: 541, z: 1.0 });
    await rec.shoot(15);
    for (const s of spots) {
      const pin = pins.nth(s.k);
      if (!inView(await pin.boundingBox())) continue;   // the last popup panned it away
      await rec.tap(pin);
      await rec.shoot(12);                                 // popup opens, map pans to fit it
      const popup = page.locator('.leaflet-popup-content');
      if (!(await popup.count())) continue;
      await rec.focus(popup, 1.3);
      await rec.shoot(30);                                 // read the top of the history
      const list = popup.locator('div[style*="overflow"]').first();
      const lb = await list.boundingBox();
      const extra = await list.evaluate((n) => n.scrollHeight - n.clientHeight).catch(() => 0);
      if (lb && extra > 10) {
        await rec.scrollBy(Math.min(extra, 320), 45, lb.x + lb.width / 2, lb.y + lb.height / 2);
        await rec.shoot(20);
      } else {
        await rec.shoot(20);
      }
      rec.setCamera({ cx: 270, cy: 541, z: 1.0 });
      await closePopup();
      await rec.shoot(10);
    }
    if (!spots.length) await rec.shoot(40);
  },
  async still({ page, rec, on, waitFor }) {
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 60000 });
    await rec.settle(2500);
    await page.waitForTimeout(2000);
  },
};
