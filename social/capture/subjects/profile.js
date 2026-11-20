// Profile & stats: weekly limit, trends, calendar, top drinks, analytics.
module.exports = {
  about: 'Your profile turns logs into stats: weekly limit, trends, calendar, top drinks, patterns.',
  readyText: 'What your crew is drinking',
  defaults: {
    hook: 'What does your\ndrinking actually\nlook like?',
    captions: ['Set a weekly limit', 'Every night, at a glance', 'Spot your patterns'],
    headline: 'Know your\nnumbers',
  },
  async open({ page, rec, on, waitFor }) {
    await page.mouse.click(497, 30);
    await rec.settle(500);
    await (await on('Profile')).click();
    await waitFor('Total Drinks');
    await rec.settle(2000);
  },
  async reel(ctx) {
    const { rec, on, caption, copy } = ctx;
    await module.exports.open(ctx);
    rec.cut('profile');
    rec.setOverlay({ text: copy.hook, style: 'hook' });
    rec.setCamera({ cx: 270, cy: 560, z: 1.0 });
    await rec.shoot(95);
    rec.setOverlay(caption(0, { at: 0.2 }));
    await rec.focus(await on(/weekly limit/i, { exact: false }), 1.03, 60);
    await rec.shoot(45);
    rec.setOverlay(caption(1, { at: 0.2 }));
    rec.setCamera({ cx: 270, cy: 560, z: 1.0 });
    await rec.scrollBy(520, 45);
    await rec.shoot(40);
    rec.setOverlay(caption(2, { at: 0.2 }));
    await rec.scrollBy(560, 45);
    await rec.shoot(45);
    await rec.scrollBy(400, 40);
    await rec.shoot(20);
  },
  async still(ctx) {
    await module.exports.open(ctx);
    await ctx.page.mouse.move(270, 400);
    await ctx.page.mouse.wheel(0, 110);
  },
};
