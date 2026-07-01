const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PATCH_PHASE_NAME = '[Suds] Patch ExpoModulesProvider';

// Shell script written to ios/ and called from the Xcode build phase.
// Runs AFTER [Expo] Configure project regenerates ExpoModulesProvider.swift,
// and BEFORE Compile Sources. Idempotent (skips if already patched).
const PATCH_SCRIPT = [
  '#!/bin/bash',
  'PROVIDER="$PODS_ROOT/Target Support Files/Pods-$PRODUCT_NAME/ExpoModulesProvider.swift"',
  '[ -f "$PROVIDER" ] || exit 0',
  "grep -q 'SudsLiveActivityBridgeModule' \"$PROVIDER\" && exit 0",
  // perl -0777: slurp mode so \n matches actual newlines across lines
  "perl -i -0777 -pe 's/import ExpoModulesCore\\n/import ExpoModulesCore\\nimport SudsLiveActivityBridge\\n/' \"$PROVIDER\"",
  "perl -i -0777 -pe 's/return \\[\\n/return [\\n      SudsLiveActivityBridgeModule.self,\\n/' \"$PROVIDER\"",
  'echo "[Suds] Patched ExpoModulesProvider.swift to include SudsLiveActivityBridgeModule"',
].join('\n');

const withLiveActivityBridge = (config) => {
  // 1. Modify use_expo_modules! to pass our module as a searchPath.
  //    Also write the ExpoModulesProvider patch script to ios/ for the build phase.
  config = withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const iosDir = modConfig.modRequest.platformProjectRoot;
      const podfilePath = path.join(iosDir, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (!contents.includes('SudsLiveActivityBridge')) {
        // Direct pod reference — works regardless of autolinking behaviour on EAS
        const podLine = "  pod 'SudsLiveActivityBridge', :path => '../modules/suds-live-activity-bridge'";
        if (contents.includes("target 'Suds' do")) {
          contents = contents.replace(
            "target 'Suds' do",
            `target 'Suds' do\n${podLine}`
          );
        }
      }

      fs.writeFileSync(podfilePath, contents);

      // Write the patch script that the Xcode build phase will call
      const scriptPath = path.join(iosDir, 'patch-expo-modules-provider.sh');
      fs.writeFileSync(scriptPath, PATCH_SCRIPT, 'utf8');
      try { fs.chmodSync(scriptPath, '755'); } catch (_) {}

      return modConfig;
    },
  ]);

  // 2. Add a build phase that patches ExpoModulesProvider.swift after
  //    [Expo] Configure project regenerates it. Positioned between the
  //    Expo configure phase and Compile Sources.
  config = withXcodeProject(config, (modConfig) => {
    const xcodeProject = modConfig.modResults;

    // Idempotency: bail if phase already exists
    const scriptPhases = xcodeProject.hash.project.objects['PBXShellScriptBuildPhase'] || {};
    const alreadyAdded = Object.values(scriptPhases).some(
      (phase) =>
        phase &&
        typeof phase === 'object' &&
        phase.name &&
        phase.name.replace(/^"|"$/g, '') === PATCH_PHASE_NAME
    );
    if (alreadyAdded) return modConfig;

    const firstTarget = xcodeProject.getFirstTarget();
    if (!firstTarget) return modConfig;
    const targetUuid = firstTarget.uuid;

    // Add the build phase (appended at end by default)
    xcodeProject.addBuildPhase(
      [],
      'PBXShellScriptBuildPhase',
      PATCH_PHASE_NAME,
      targetUuid,
      {
        shellPath: '/bin/bash',
        // Xcode expands $(SRCROOT) to the ios/ directory at build time
        shellScript: '"$SRCROOT/patch-expo-modules-provider.sh"',
        inputPaths: [],
        outputPaths: [],
      }
    );

    // Reorder: move our phase to immediately after [Expo] Configure project
    const nativeTargetSection = xcodeProject.hash.project.objects['PBXNativeTarget'];
    if (!nativeTargetSection || !nativeTargetSection[targetUuid]) return modConfig;

    const buildPhases = nativeTargetSection[targetUuid].buildPhases;
    if (!Array.isArray(buildPhases)) return modConfig;

    const expoIdx = buildPhases.findIndex(
      (p) => p.comment === '[Expo] Configure project'
    );
    const ourIdx = buildPhases.findIndex((p) => p.comment === PATCH_PHASE_NAME);

    if (expoIdx !== -1 && ourIdx !== -1 && ourIdx !== expoIdx + 1) {
      const [ourPhase] = buildPhases.splice(ourIdx, 1);
      const newExpoIdx = buildPhases.findIndex(
        (p) => p.comment === '[Expo] Configure project'
      );
      buildPhases.splice(newExpoIdx + 1, 0, ourPhase);
    }

    return modConfig;
  });

  return config;
};

module.exports = withLiveActivityBridge;
