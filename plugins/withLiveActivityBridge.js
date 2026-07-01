const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PATCH_MARKER = 'SudsLiveActivityBridgeModule';

const PATCH_RUBY = `
  # [Suds] Patch ExpoModulesProvider + ExpoConfigScript so our local module is registered
  Dir.glob(File.join(installer.sandbox.root, "Target Support Files", "*", "ExpoModulesProvider.swift")).each do |fpath|
    content = File.read(fpath)
    unless content.include?("SudsLiveActivityBridgeModule")
      content = content.sub("return [\\n", "return [\\n      SudsLiveActivityBridgeModule.self,\\n")
      File.write(fpath, content)
      puts "[Suds] Patched ExpoModulesProvider at #{fpath}"
    end
  end
  Dir.glob(File.join(installer.sandbox.root, "Target Support Files", "*", "ExpoConfigScript.sh")).each do |fpath|
    content = File.read(fpath)
    unless content.include?('"suds-live-activity-bridge"')
      content = content.sub("--packages ", '--packages "suds-live-activity-bridge" ')
      File.write(fpath, content)
      puts "[Suds] Patched ExpoConfigScript at #{fpath}"
    end
  end
`;

const withLiveActivityBridge = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // 1. Add the pod explicitly BEFORE use_expo_modules!
      if (!contents.includes("pod 'SudsLiveActivityBridge'")) {
        contents = contents.replace(
          'use_expo_modules!',
          `pod 'SudsLiveActivityBridge', :path => '../modules/suds-live-activity-bridge'\n  use_expo_modules!`
        );
      }

      // 2. Inject patch code — merge into existing post_install if present,
      //    otherwise append a new block. CocoaPods only allows one post_install.
      if (!contents.includes(PATCH_MARKER)) {
        const existingHook = /^post_install do \|installer\|/m.test(contents);
        if (existingHook) {
          // Insert our code right after the opening line of the existing hook
          contents = contents.replace(
            /^(post_install do \|installer\|)/m,
            `$1${PATCH_RUBY}`
          );
        } else {
          contents += `\npost_install do |installer|${PATCH_RUBY}end\n`;
        }
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};

module.exports = withLiveActivityBridge;
