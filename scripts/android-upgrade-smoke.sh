#!/usr/bin/env bash
set -euo pipefail
pkg=com.hisabtechnologies.mezgeb
runner="$pkg.test/androidx.test.runner.AndroidJUnitRunner"
testClass="$pkg.LedgerUpgradeTest"
mkdir -p upgrade-diagnostics
cleanup(){
  adb logcat -d > upgrade-diagnostics/logcat.txt || true
  adb exec-out screencap -p > upgrade-diagnostics/screen.png || true
  adb shell cmd connectivity airplane-mode disable || true
  adb shell svc wifi enable || true
  adb shell svc data enable || true
}
trap cleanup EXIT
run_test(){
  local name="$1"
  adb shell am force-stop "$pkg"
  adb shell am instrument -w -e class "$testClass#$name" "$runner" | tee "upgrade-diagnostics/$name-$(date +%s).txt"
  grep -Fq 'OK (1 test)' "$(ls -t upgrade-diagnostics/"$name"-*.txt | head -1)"
}
adb install "$RUNNER_TEMP/mezgeb-baseline.apk"
adb install android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
run_test seedPreviousRelease
run_test verifyPreviousOrUpgradedLedger
adb shell am force-stop "$pkg"
# Same-signing-key, increasing-version install. No uninstall, reset or clear.
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell cmd connectivity airplane-mode enable
adb shell svc wifi disable
adb shell svc data disable
run_test verifyOfflineUpgrade
run_test verifyPreviousOrUpgradedLedger
adb shell cmd connectivity airplane-mode disable
adb shell svc wifi enable
adb shell svc data enable
run_test verifyPreviousOrUpgradedLedger
echo "Upgrade, offline launch, restart, and synthetic ledger retention passed."
