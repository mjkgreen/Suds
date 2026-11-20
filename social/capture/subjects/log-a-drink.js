// Logging a drink: the form, autocomplete, and it landing in the feed.
module.exports = {
  about: 'Logging a drink takes seconds; it lands in your friends\' feed; the weekly limit updates.',
  defaults: {
    hook: 'Your night out,\nlogged in 5 seconds',
    captions: ['Tap. Type. Done.', 'Your crew sees it\nright away', 'Know your limits'],
    headline: 'Log a drink\nin seconds',
  },
  async reel({ rec, page, on, caption, copy, waitFor, scenario }) {
    rec.cut('feed');
    rec.setOverlay({ text: copy.hook, style: 'hook' });
    rec.setCamera({ cx: 270, cy: 560, z: 1.0 });
    await rec.shoot(20);
    rec.setCamera({ cy: 640, z: 1.03 });
    await rec.scrollBy(330, 70);
    await rec.shoot(15);

    await page.mouse.wheel(0, -5000);               // off camera: back to top, open the form
    await rec.settle(500);
    await page.mouse.click(453, 30);
    await waitFor('Log a Drink');
    await rec.settle(1500);
    rec.cut('log');
    rec.setOverlay(caption(0));
    rec.setCamera({ cx: 270, cy: 420, z: 1.0 });
    await rec.shoot(10);
    const log = scenario.log;
    await rec.focus(await on(log.type_label), 1.04);
    await rec.shoot(12);
    await rec.tap(await on(log.type_label));
    await rec.shoot(12);
    const name = page.getByPlaceholder('e.g. IPA, Old Fashioned');
    await rec.focus(name, 1.04, -30);
    await rec.shoot(8);
    await rec.type(name, log.prefix, 3);
    await rec.shoot(8);
    const suggestion = await rec.onTop(log.name);
    if (suggestion) await rec.tap(suggestion); else await rec.type(name, log.name.slice(log.prefix.length), 2);
    await rec.shoot(14);
    await rec.focus(await on('Location (optional)'), 1.04, 40);
    await rec.shoot(24);
    const logIt = await on('Log It');
    await rec.focus(logIt, 1.04, -150);
    await rec.shoot(10);
    await rec.tap(logIt);

    rec.setOverlay(caption(1, { at: 'above-focus' }));
    let mine = null;
    await rec.shootUntil(async () => !!(mine = await rec.onTop(scenario.people[0].name)), 90);
    rec.cut('posted');
    await rec.focus(mine, 1.04, 110);
    await rec.shoot(60);

    await page.mouse.click(497, 30);
    await rec.settle(500);
    await (await on('Profile')).click();
    await rec.settle(2000);
    rec.cut('profile');
    rec.setOverlay(caption(2, { at: 'above-focus' }));
    await rec.focus(await on(/weekly limit/i, { exact: false }), 1.04, 30);
    await rec.shoot(40);
    rec.setCamera({ cx: 270, cy: 600, z: 1.0 });
    await rec.scrollBy(380, 50);
    await rec.shoot(25);
  },
  async still({ page, rec, on, waitFor, scenario }) {
    await page.mouse.click(453, 30);
    await waitFor('Log a Drink');
    await rec.settle(1500);
    const type = await rec.onTop(scenario.log.type_label); if (type) await type.click();
    await page.getByPlaceholder('e.g. IPA, Old Fashioned').fill(scenario.log.name);
    await page.keyboard.press('Tab');
    await rec.settle(500);
  },
};
