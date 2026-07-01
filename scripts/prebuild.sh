#!/bin/bash
set -euo pipefail

# EAS calls this as: bash scripts/prebuild.sh --platform ios
# Pass all args through to expo prebuild so --platform ios is respected.
npx expo prebuild --no-install "$@"

# Patch ios/Podfile after all config plugins have run but before pod install.
node scripts/patch-podfile.js
