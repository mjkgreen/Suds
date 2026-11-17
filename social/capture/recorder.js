// Frame-by-frame recorder for the real app.
//
// The page runs on Playwright's fake clock: time only moves when we advance it
// by one frame (1/30 s, or more to fast-forward), then we take a JPEG. So
// animations play at exactly the speed we choose, however slow the screenshot.
// Each frame also records a camera target, active overlay and any tap, which
// compose.py turns into the final 1080x1920 video.
const fs = require('fs');
const path = require('path');

const FRAME_MS = 1000 / 30;

class Recorder {
  constructor(page, outDir, { topCrop = 61, viewport = { width: 540, height: 1021 } } = {}) {
    this.page = page;
    this.dir = outDir;
    fs.mkdirSync(path.join(outDir, 'frames'), { recursive: true });
    this.frames = [];
    this.meta = { topCrop, viewport, scenes: [] };
    this.cam = { cx: viewport.width / 2, cy: topCrop + (viewport.height - topCrop) / 2, z: 1 };
    this.overlay = null;
    this.focusBox = null;
    this.pendingTap = null;
    this.scene = 0;
  }

  /** Install the fake clock. Call before page.goto (openApp's beforeLoad). */
  static async installClock(page) {
    await page.clock.install({ time: new Date() });
  }

  /** Let the app settle off-camera (load data, finish a navigation). */
  async settle(ms = 1500, realWaitMs = 400) {
    for (let t = 0; t < ms; t += 250) {
      await this.page.clock.runFor(250);
      await this.page.waitForTimeout(realWaitMs / (ms / 250));
    }
  }

  /** Hard cut: the next frame starts a new scene (camera snaps, no easing across). */
  cut(name) {
    this.scene += 1;
    this.meta.scenes.push({ name, startFrame: this.frames.length });
  }

  /**
   * The copy of `text` that is actually on top (screens behind a pushed screen
   * stay in the DOM, so plain getByText can find a hidden copy).
   */
  async onTop(text, { exact = true } = {}) {
    const all = this.page.getByText(text, { exact });
    const n = await all.count();
    for (let i = 0; i < n; i++) {
      const el = all.nth(i);
      const hit = await el.evaluate((node) => {
        const r = node.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > innerHeight) return false;
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!top && (node === top || node.contains(top) || top.contains(node));
      }).catch(() => false);
      if (hit) return el;
    }
    return null;
  }

  setCamera(cam, focusBox = null) { this.cam = { ...this.cam, ...cam }; this.focusBox = focusBox; }
  setOverlay(o) { this.overlay = o; }

  /**
   * Camera target on a locator's box, with a zoom. The phone UI is narrow, so
   * the camera only pans vertically (sideways pans clip the layout's edges).
   */
  async focus(locator, z = 1.12, dy = 0) {
    const b = await locator.boundingBox();
    if (b) {
      this.setCamera({ cx: this.meta.viewport.width / 2, cy: b.y + b.height / 2 + dy, z });
      this.focusBox = { x: b.x, y: b.y, w: b.width, h: b.height };
    }
  }

  /** Advance n frames, `speed` times real time, screenshotting each. */
  async shoot(n = 1, speed = 1) {
    for (let i = 0; i < n; i++) {
      await this.page.clock.runFor(FRAME_MS * speed);
      await this.page.waitForTimeout(8); // let network callbacks land
      const idx = this.frames.length;
      const file = `frames/${String(idx).padStart(5, '0')}.jpg`;
      await this.page.screenshot({ path: path.join(this.dir, file), type: 'jpeg', quality: 92 });
      this.frames.push({ file, scene: this.scene, cam: { ...this.cam }, focus: this.focusBox, overlay: this.overlay, tap: this.pendingTap, speed });
      this.pendingTap = null;
    }
  }

  /** Shoot until fn() is true (checked each frame), at most maxFrames. */
  async shootUntil(fn, maxFrames = 90, speed = 1) {
    for (let i = 0; i < maxFrames; i++) {
      if (await fn()) return true;
      await this.shoot(1, speed);
    }
    return false;
  }

  /** A real click, marked so compose.py draws a touch ring there. */
  async tap(locator, { holdFrames = 4 } = {}) {
    const b = await locator.boundingBox();
    if (!b) throw new Error('tap target not visible');
    this.pendingTap = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await this.shoot(holdFrames);          // finger arrives
    await locator.click();
  }

  /** Type into a field like a person: one character every `perChar` frames. */
  async type(locator, text, perChar = 3) {
    await this.tap(locator, { holdFrames: 3 });
    for (const ch of text) {
      await this.page.keyboard.type(ch);
      await this.shoot(perChar);
    }
  }

  async scrollBy(dy, frames, x = 270, y = 600) {
    await this.page.mouse.move(x, y);
    for (let i = 0; i < frames; i++) {
      await this.page.mouse.wheel(0, dy / frames);
      await this.shoot(1);
    }
  }

  save(extra = {}) {
    fs.writeFileSync(path.join(this.dir, 'timeline.json'),
      JSON.stringify({ ...this.meta, ...extra, frames: this.frames }, null, 1));
  }
}

module.exports = { Recorder, FRAME_MS };
