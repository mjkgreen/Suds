/**
 * Patches ios/Podfile after expo prebuild completes but before pod install.
 * Called via prebuildCommand in eas.json:
 *   "expo prebuild --no-install && node scripts/patch-podfile.js"
 *
 * Two fixes:
 *   1. Add pod 'SudsLiveActivityBridge' before use_expo_modules! so CocoaPods
 *      compiles the local module.
 *   2. Inject a post_install snippet that patches ExpoModulesProvider.swift and
 *      ExpoConfigScript.sh to register SudsLiveActivityBridgeModule. Must merge
 *      into the existing post_install block — CocoaPods disallows multiple blocks.
 */

const fs = require('fs');
const path = require('path');

const PATCH_MARKER = 'SudsLiveActivityBridgeModule';
const podfilePath = path.join(process.cwd(), 'ios', 'Podfile');

if (!fs.existsSync(podfilePath)) {
  console.log('[patch-podfile] No ios/Podfile found — skipping (Android build?)');
  process.exit(0);
}

let contents = fs.readFileSync(podfilePath, 'utf8');

// ── 1. Pod declaration ────────────────────────────────────────────────────────
if (!contents.includes("pod 'SudsLiveActivityBridge'")) {
  contents = contents.replace(
    'use_expo_modules!',
    `pod 'SudsLiveActivityBridge', :path => '../modules/suds-live-activity-bridge'\n  use_expo_modules!`
  );
  console.log('[patch-podfile] Added SudsLiveActivityBridge pod declaration');
} else {
  console.log('[patch-podfile] Pod declaration already present');
}

// ── 2. post_install injection ─────────────────────────────────────────────────
if (contents.includes(PATCH_MARKER)) {
  console.log('[patch-podfile] post_install patch already present — skipping');
  fs.writeFileSync(podfilePath, contents);
  process.exit(0);
}

const PATCH_RUBY = `
  # [Suds] Patch ExpoModulesProvider.swift and ExpoConfigScript.sh to register
  # SudsLiveActivityBridgeModule (autolinking may miss local modules on EAS servers)
  Dir.glob(File.join(installer.sandbox.root, "Target Support Files", "*", "ExpoModulesProvider.swift")).each do |fpath|
    content = File.read(fpath)
    unless content.include?("SudsLiveActivityBridgeModule")
      content = content.sub("return [\\n", "return [\\n      SudsLiveActivityBridgeModule.self,\\n")
      File.write(fpath, content)
      puts "[Suds] Patched ExpoModulesProvider at \#{fpath}"
    end
  end
  Dir.glob(File.join(installer.sandbox.root, "Target Support Files", "*", "ExpoConfigScript.sh")).each do |fpath|
    content = File.read(fpath)
    unless content.include?('"suds-live-activity-bridge"')
      content = content.sub("--packages ", '--packages "suds-live-activity-bridge" ')
      File.write(fpath, content)
      puts "[Suds] Patched ExpoConfigScript at \#{fpath}"
    end
  end
`;

const postInstallCount = (contents.match(/^post_install\s+do/mg) || []).length;
console.log(`[patch-podfile] Found ${postInstallCount} post_install block(s)`);

if (postInstallCount >= 1) {
  contents = contents.replace(
    /^(post_install\s+do\s+\|[^|]+\|)/m,
    (match) => `${match}${PATCH_RUBY}`
  );
  console.log('[patch-podfile] Merged into existing post_install block');
} else {
  contents += `\npost_install do |installer|${PATCH_RUBY}end\n`;
  console.log('[patch-podfile] Added new post_install block');
}

fs.writeFileSync(podfilePath, contents);
console.log('[patch-podfile] Done');
