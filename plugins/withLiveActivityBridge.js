const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// expo-modules-autolinking doesn't find local modules in ./modules on EAS because
// package.json `expo.autolinking` config is read by JS but the Ruby `use_expo_modules!`
// call passes no searchPaths, so JS never receives the nativeModulesDir option.
//
// Fix: modify `use_expo_modules!` in the Podfile to pass an absolute searchPaths entry
// for our module. Ruby passes it as a positional arg to the node resolve command, which
// calls scanDependenciesInSearchPath on the module root → finds package.json → registers it.
// Autolinking then adds the pod AND registers SudsLiveActivityBridgeModule in
// ExpoModulesProvider — no post_install patching needed.
const withLiveActivityBridge = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Pass the module path directly to use_expo_modules! so Ruby's base_command_args
      // includes it as a positional searchPath for the node autolinking command.
      // File.expand_path resolves relative to __dir__ (the ios/ directory) at pod install time.
      //
      // Using simple string replacement instead of regex to handle any trailing content
      // on the use_expo_modules! line (comments, whitespace, etc.).
      if (!contents.includes('suds-live-activity-bridge')) {
        const searchPathArg = `{ searchPaths: [File.expand_path('../modules/suds-live-activity-bridge', __dir__)] }`;
        if (contents.includes('use_expo_modules!')) {
          contents = contents.replace(
            'use_expo_modules!',
            `use_expo_modules!(${searchPathArg})`
          );
        }
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
};

module.exports = withLiveActivityBridge;
