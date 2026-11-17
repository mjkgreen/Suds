// Night Out: start one in a tap, then a past night's page (photos, rounds, route, BAC).
const SESSION = '/session/00000000-0000-4000-c000-000000000003'; // "Mia's birthday" in the seed
module.exports = {
  about: 'Night Out groups a whole evening: rounds, spots, photos, friends, pace and a BAC estimate.',
  defaults: {
    hook: 'Your whole night out,\nin one place',
    captions: ['One tap starts the night', 'Every round, every spot', 'Pace yourself'],
    headline: 'Every round.\nEvery spot.',
  },
  async reel({ rec, page, on, caption, copy, waitFor }) {
    rec.cut('start');
    rec.setOverlay({ text: copy.hook, style: 'hook' });
    rec.setCamera({ cx: 270, cy: 540, z: 1.0 });
    await rec.shoot(45);
    rec.setOverlay(caption(0));
    await rec.focus(await on('Start a Night Out'), 1.03, 200);
    await rec.shoot(10);
    await rec.tap(await on('Start a Night Out'));
    await rec.shoot(14);
    const input = page.getByPlaceholder(/Friday at The Crown/);
    await rec.type(input, 'Friday with the crew', 2);
    await rec.shoot(8);
    await rec.tap(await on("Let's go 🌙", { exact: false }).catch(() => on(/Let's go/, { exact: false })));
    await rec.shoot(40);

    await page.goto('http://localhost:8081' + SESSION);          // off camera
    await waitFor("Mia's birthday");
    await rec.settle(2500);
    rec.cut('session');
    rec.setOverlay(caption(1));
    rec.setCamera({ cx: 270, cy: 420, z: 1.0 });
    const photo = page.locator('img').first();
    await rec.shoot(25);
    await rec.swipe(photo, 1, 12);
    await rec.shoot(22);
    await rec.swipe(photo, 1, 12);
    await rec.shoot(18);
    await rec.scrollBy(400, 40);                 // stats + route between spots
    await rec.shoot(35);
    rec.setOverlay(caption(2));
    await rec.scrollBy(260, 30);                 // BAC profile
    await rec.shoot(55);
    await rec.scrollBy(700, 40, 270, 600, 1.5);  // the drinks of the night, quicker
    await rec.shoot(20);
  },
  async still({ page, rec, on, waitFor }) {
    await page.goto('http://localhost:8081' + SESSION);
    await waitFor("Mia's birthday");
    await rec.settle(2000);
    await page.mouse.move(270, 400);
    await page.mouse.wheel(0, 260);
  },
};
