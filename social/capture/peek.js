// Screenshot a route for a quick look: node peek.js /feed out.png [width height]
const { openApp } = require('./lib');
(async () => {
  const [route = '/feed', out = 'peek.png', w = 540, h = 960] = process.argv.slice(2);
  const { browser, page } = await openApp({ route, width: +w, height: +h, scale: 1 });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: out });
  await browser.close();
})();
