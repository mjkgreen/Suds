const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// expo-modules-autolinking doesn't follow workspace symlinks on EAS Build servers,
// so suds-live-activity-bridge never appears in pod install. Explicitly add it here.
const withLiveActivityBridge = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (!contents.includes('SudsLiveActivityBridge')) {
        contents = contents.replace(
          'use_expo_modules!',
          `use_expo_modules!\n  pod 'SudsLiveActivityBridge', :path => '../modules/suds-live-activity-bridge'`
        );
        fs.writeFileSync(podfilePath, contents);
      }

      return config;
    },
  ]);
};

module.exports = withLiveActivityBridge;
