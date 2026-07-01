const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// expo-modules-autolinking doesn't reliably find local modules on EAS Build servers.
// Two problems to solve:
//   1. Pod not in Podfile    → add it explicitly before use_expo_modules!
//   2. SudsLiveActivityBridgeModule not in ExpoModulesProvider.swift →
//      pod install generates ExpoModulesProvider AND embeds an ExpoConfigScript.sh that
//      regenerates it on every Xcode build; we must patch both files via post_install.
const withLiveActivityBridge = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // 1. Add the pod explicitly BEFORE use_expo_modules! so CocoaPods skips it when
      //    autolinking also tries to add it (the Ruby manager checks for duplicates).
      if (!contents.includes("pod 'SudsLiveActivityBridge'")) {
        contents = contents.replace(
          'use_expo_modules!',
          `pod 'SudsLiveActivityBridge', :path => '../modules/suds-live-activity-bridge'\n  use_expo_modules!`
        );
      }

      // 2. post_install hook — runs after pod install generates ExpoModulesProvider.swift
      //    and ExpoConfigScript.sh, so we can patch both to include our module.
      if (!contents.includes('SudsLiveActivityBridgeModule')) {
        contents += `
post_install do |installer|
  # Belt-and-suspenders: ensure SudsLiveActivityBridgeModule is registered even when
  # autolinking's resolve misses our local module on EAS Build servers.
  Dir.glob(File.join(installer.sandbox.root, "Target Support Files", "*", "ExpoModulesProvider.swift")).each do |fpath|
    content = File.read(fpath)
    unless content.include?("SudsLiveActivityBridgeModule")
      # Insert at the top of the getModuleClasses array (first occurrence of "return [\\n")
      content = content.sub("return [\\n", "return [\\n      SudsLiveActivityBridgeModule.self,\\n")
      File.write(fpath, content)
      puts "[Suds] Patched ExpoModulesProvider at #{fpath}"
    end
  end
  Dir.glob(File.join(installer.sandbox.root, "Target Support Files", "*", "ExpoConfigScript.sh")).each do |fpath|
    content = File.read(fpath)
    unless content.include?('"suds-live-activity-bridge"')
      # Add our package to the --packages list so Xcode build-phase re-runs also include it
      content = content.sub("--packages ", '--packages "suds-live-activity-bridge" ')
      File.write(fpath, content)
      puts "[Suds] Patched ExpoConfigScript at #{fpath}"
    end
  end
end
`;
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};

module.exports = withLiveActivityBridge;
