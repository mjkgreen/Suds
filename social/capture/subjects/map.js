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

    // Off camera: zoom the map in on the busiest spot (Leaflet animates on the real clock).
    hot = await busiest();
    if (hot) {
      await page.mouse.move(hot.x, hot.y);
      await page.mouse.wheel(0, -100); await page.waitForTimeout(1200);
      await rec.settle(1000);
      await page.waitForTimeout(2500);
    }
    rec.cut('zoomed');
    rec.setOverlay(caption(2));
    const route = page.locator('path.leaflet-interactive').first();
    if (await route.count()) await rec.focus(route, 1.15); else rec.setCamera({ cx: 270, cy: 541, z: 1.1 });
    await rec.shoot(50);
    // Off camera: find a pin whose popup links to a Night Out, then close it.
    let target = null;
    const pins = page.locator('.leaflet-marker-icon');
    for (let k = 0; k < Math.min(await pins.count(), 25) && !target; k++) {
      const pin = pins.nth(k);
      const b = await pin.boundingBox();
      if (!b || b.y < 140 || b.y > 900 || b.x < 40 || b.x > 500) continue;
      await pin.click().catch(() => {});
      await page.waitForTimeout(400);
      if (await page.locator('.leaflet-popup:has-text("View Session Detail")').count()) target = b;
      await page.keyboard.press('Escape');
      await page.locator('.leaflet-popup-close-button').click().catch(() => {});
      await page.waitForTimeout(300);
    }
    if (target) {
      rec.setCamera({ cx: target.x, cy: target.y - 90, z: 1.2 });
      await rec.shoot(20);
      rec.pendingTap = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
      await rec.shoot(4);
      await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
      await rec.shoot(35);
      const link = page.locator('.leaflet-popup').getByText('View Session Detail');
      await rec.tap(link);
      await waitFor('Night Out BAC Profile', 30000).catch(() => {});
      await rec.settle(1500);
      rec.cut('session');
      rec.setCamera({ cx: 270, cy: 541, z: 1.0 });
      await rec.shoot(45);
    } else {
      await rec.shoot(40);
    }
  },
  async still({ page, rec, on, waitFor }) {
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 60000 });
    await rec.settle(2500);
    await page.waitForTimeout(2000);
  },
};
