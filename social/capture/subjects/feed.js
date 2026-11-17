// The social feed: friends' drinks with photos and video, likes, tags, comments.
module.exports = {
  about: 'The feed: see what friends are drinking, with photos, tags, likes and comments.',
  defaults: {
    hook: 'See what your\ncrew is drinking',
    captions: ['Photos from the night', 'Share the whole night', 'Cheers from anywhere'],
    headline: 'See what your\ncrew is drinking',
  },
  async reel({ rec, page, on, caption, copy, waitFor }) {
    rec.cut('feed');
    rec.setOverlay({ text: copy.hook, style: 'hook' });
    rec.setCamera({ cx: 270, cy: 560, z: 1.0 });
    await rec.shoot(30);
    await rec.scrollBy(170, 40);
    await rec.shoot(30);                       // the video post plays
    rec.setOverlay(caption(0));
    await rec.scrollBy(760, 90);
    await rec.shoot(20);
    // like Sam's post
    const hearts = page.locator('[aria-label*="ike" i], [data-testid*="like" i]');
    await rec.scrollBy(500, 50);
    await rec.shoot(15);
    // Sam's Patio night: tags + comments
    await page.mouse.wheel(0, 5000);           // off camera: find the session card
    await rec.settle(800);
    const card = await rec.onTop('Patio night');
    if (card) {
      await card.scrollIntoViewIfNeeded();
      await rec.settle(500);
      rec.cut('patio');
      rec.setOverlay(caption(1, { at: 'above-focus' }));
      await rec.focus(card, 1.03, 160);
      await rec.shoot(30);
      const details = await rec.onTop('View details');
      if (details) {
        await rec.tap(details);
        await waitFor('Patio night');
        await rec.shoot(30);
        await rec.scrollBy(500, 45);
        await rec.shoot(25);
      }
    }
    // comment on Maya's post
    await page.goto('http://localhost:8081/drink/00000000-0000-4000-b000-000000000001');   // off camera
    await waitFor('Post-work reset');
    await rec.settle(2000);
    rec.cut('comment');
    rec.setOverlay(caption(2));
    rec.setCamera({ cx: 270, cy: 560, z: 1.0 });
    await rec.shoot(20);
    const box = page.getByPlaceholder(/comment/i).first();
    await rec.focus(box, 1.03, -200);
    await rec.type(box, 'save me a seat!', 2);
    await rec.shoot(10);
    const bb = await box.boundingBox();           // the round send button sits just right of the box
    const send = { x: bb.x + bb.width + 30, y: bb.y + bb.height / 2 };
    rec.pendingTap = send;
    await rec.shoot(4);
    await page.mouse.click(send.x, send.y);
    await rec.shoot(45);
  },
  async still({ page, rec, on, waitFor }) {
    await page.mouse.move(270, 400);
    await page.mouse.wheel(0, 120);
  },
};
