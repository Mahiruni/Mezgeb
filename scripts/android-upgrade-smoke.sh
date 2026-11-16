#!/usr/bin/env bash
set -euo pipefail
pkg=com.hisabtechnologies.mezgeb
runner="$pkg.test/androidx.test.runner.AndroidJUnitRunner"
testClass="$pkg.LedgerUpgradeTest"
mkdir -p upgrade-diagnostics
firewall4=0
firewall6=0
restore_network(){
  if [[ "$firewall4" == 1 ]]; then adb shell iptables -D OUTPUT ! -o lo -j REJECT || true; firewall4=0; fi
  if [[ "$firewall6" == 1 ]]; then adb shell ip6tables -D OUTPUT ! -o lo -j REJECT || true; firewall6=0; fi
  adb shell cmd connectivity airplane-mode disable || true
  adb shell svc wifi enable || true
  adb shell svc data enable || true
}
cleanup(){
  restore_network
  adb logcat -d > upgrade-diagnostics/logcat.txt || true
  adb exec-out screencap -p > upgrade-diagnostics/screen.png || true
}
trap cleanup EXIT
run_test(){
  local name="$1" out="upgrade-diagnostics/$1-$(date +%s).txt"
  adb shell am force-stop "$pkg"
  adb shell am instrument -w -e class "$testClass#$name" "$runner" | tee "$out"
  grep -Fq 'OK (1 test)' "$out"
}
adb install "$RUNNER_TEMP/mezgeb-baseline.apk"
adb install android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
run_test seedPreviousRelease
run_test verifyPreviousOrUpgradedLedger
adb shell am force-stop "$pkg"
# Real in-place installation, same CI signing key. No uninstall or data clearing.
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
# Airplane mode alone does not disconnect emulator virtual Ethernet.
# The disposable Google APIs emulator must enforce both IPv4 and IPv6 egress isolation.
adb root
adb wait-for-device
test "$(adb shell id -u | tr -d '\r')" = 0
adb shell cmd connectivity airplane-mode enable
adb shell svc wifi disable
adb shell svc data disable
adb shell iptables -I OUTPUT 1 ! -o lo -j REJECT
firewall4=1
adb shell ip6tables -I OUTPUT 1 ! -o lo -j REJECT
firewall6=1
adb shell iptables -C OUTPUT ! -o lo -j REJECT
adb shell ip6tables -C OUTPUT ! -o lo -j REJECT
run_test verifyOfflineUpgrade
run_test verifySignatureExperience
run_test verifyPreviousOrUpgradedLedger
run_test recordOfflineExpense
run_test verifyOfflineExpenseRetained
restore_network
run_test verifyOfflineExpenseRetained
echo "Upgrade, isolated offline launch, offline UI write, restart and reconnection passed."
