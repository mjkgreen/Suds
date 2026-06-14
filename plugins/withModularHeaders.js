const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// AppCheckCore (pulled in by @react-native-google-signin/google-signin) is a Swift pod
// that requires GoogleUtilities and RecaptchaInterop to expose module maps when building
// as static libraries. Insert the pod declarations at the top level of the Podfile so
// CocoaPods generates those maps before pod install runs.
const withModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (!contents.includes(':modular_headers => true')) {
        contents = contents.replace(
          /^(target ')/m,
          `pod 'GoogleUtilities', :modular_headers => true\npod 'RecaptchaInterop', :modular_headers => true\n\n$1`
        );
        fs.writeFileSync(podfilePath, contents);
      }

      return config;
    },
  ]);
};

module.exports = withModularHeaders;
