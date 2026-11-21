#!/usr/bin/env node
/**
 * After `expo export -p web`: add Apple's Smart App Banner to every exported page.
 *
 * iPhone Safari shows its "Get / Open Suds" banner only when this meta tag is in
 * the HTML it first loads (adding it from JS is too late). Expo's static export
 * has no hook for site-wide head tags (a custom app/+html.tsx drops the bundle
 * <script> tags in this Expo version), so it's added here. Idempotent.
 * Pages that want "Open" to land somewhere specific (invites) update the tag's
 * content at runtime rather than adding a second one.
 *
 *   node scripts/web-postbuild.js [distDir=dist]
 */
const fs = require('fs');
const path = require('path');

const TAG = '<meta name="apple-itunes-app" content="app-id=6761397970"/>';
const dist = path.resolve(process.argv[2] || 'dist');

function* htmlFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

let changed = 0;
for (const file of htmlFiles(dist)) {
  const html = fs.readFileSync(file, 'utf8');
  if (html.includes('name="apple-itunes-app"') || !html.includes('<head>')) continue;
  fs.writeFileSync(file, html.replace('<head>', `<head>${TAG}`));
  changed += 1;
}
console.log(`web-postbuild: Smart App Banner added to ${changed} page(s) in ${path.relative(process.cwd(), dist) || '.'}`);
