// Capture one subject from the real app.
//
//   node run.js <subject> reel  <outDir> [copy.json]   frames + timeline.json for render/compose.py
//   node run.js <subject> still <outDir> [copy.json]   app.png (1080x1174) for render/still.py
//
// copy.json (optional) overrides the subject's default words:
//   { "hook": "...", "captions": ["...", "..."], "headline": "..." }
// Subjects live in ./subjects/<name>.js and export { about, defaults, reel(ctx), still(ctx) }.
const fs = require('fs');
const path = require('path');
const { openApp, SCENARIO } = require('./lib');
const { Recorder } = require('./recorder');

const STILL_VIEWPORT = { width: 540, height: 61 + 587 };

(async () => {
  const [subject, format, out, copyFile] = process.argv.slice(2);
  const mod = require(`./subjects/${subject}`);
  const copy = { ...mod.defaults, ...(copyFile ? JSON.parse(fs.readFileSync(copyFile, 'utf8')) : {}) };
  fs.mkdirSync(out, { recursive: true });
  const reel = format === 'reel';
  const vp = reel ? { width: 540, height: 1021 } : STILL_VIEWPORT;
  const { browser, page } = await openApp({ route: mod.startRoute || '/feed', ...vp, scale: reel ? 3 : 2,
    beforeLoad: Recorder.installClock });
  const rec = new Recorder(page, out, { viewport: vp });
  const ctx = {
    rec, page, copy, scenario: SCENARIO,
    person: (i) => SCENARIO.people[i],
    caption: (i, extra = {}) => (copy.captions[i] ? { text: copy.captions[i], style: 'caption', ...extra } : null),
    // the copy of `text` that is actually on screen; throws if it isn't
    on: async (text, opts) => { const el = await rec.onTop(text, opts); if (!el) throw new Error(`"${text}" not on screen`); return el; },
    // ready when any copy of `text` is visible: screens behind the current one are hidden,
    // and it may be below the fold (unlike `on`, which needs it on screen to tap it)
    waitFor: async (text, ms = 60000) => {
      for (let t = 0; t < ms; t += 250) {
        const all = page.getByText(text, { exact: false });
        for (let i = 0; i < await all.count(); i++) if (await all.nth(i).isVisible().catch(() => false)) return;
        await page.clock.runFor(250); await page.waitForTimeout(250);
      }
      throw new Error(`timed out waiting for "${text}"`);
    },
  };
  await ctx.waitFor(mod.readyText || 'What your crew is drinking', 180000);
  await rec.settle(2000);
  if (reel) {
    await mod.reel(ctx);
    rec.save({ subject, hook: copy.hook, captions: copy.captions });
    console.log(`${rec.frames.length} frames -> ${out}`);
  } else {
    await mod.still(ctx);
    await rec.settle(800);
    const shot = path.join(out, 'app.png');
    await page.screenshot({ path: shot, clip: { x: 0, y: 61, width: vp.width, height: vp.height - 61 } });
    fs.writeFileSync(path.join(out, 'still.json'), JSON.stringify({ subject, headline: copy.headline, sub: copy.sub || null }));
    console.log(`still -> ${shot}`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
