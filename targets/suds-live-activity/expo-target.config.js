/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'SudsLiveActivity',
  deploymentTarget: '16.1',
  bundleIdentifier: 'com.sudssocial.app.liveactivity',
  frameworks: ['ActivityKit', 'WidgetKit', 'SwiftUI'],
  entitlements: {
    'com.apple.security.application-groups': ['group.com.sudssocial.app'],
  },
};
