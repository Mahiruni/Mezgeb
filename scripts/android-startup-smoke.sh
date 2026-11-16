#!/usr/bin/env bash
set -euo pipefail
pkg=com.hisabtechnologies.mezgeb
mkdir -p startup-diagnostics
cleanup(){ adb logcat -d > startup-diagnostics/logcat.txt || true; adb shell dumpsys activity activities > startup-diagnostics/activities.txt || true; adb exec-out screencap -p > startup-diagnostics/screen.png || true; }
trap cleanup EXIT
adb install android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb shell am start -W -n "$pkg/.MainActivity"
for i in $(seq 1 30); do
  if adb logcat -d -s MezgebStartup:I | grep -Fq 'Bundled interface ready'; then break; fi
  if adb logcat -d -s AndroidRuntime:E | grep -Fq "Process: $pkg"; then echo "Android startup crash"; exit 1; fi
  sleep 1
done
adb shell pidof "$pkg"
adb logcat -d -s MezgebStartup:I > startup-diagnostics/startup.txt
grep -F 'Bundled interface ready' startup-diagnostics/startup.txt
if adb logcat -d -s AndroidRuntime:E | grep -Fq "Process: $pkg"; then exit 1; fi
# Repeat after process death without erasing ledger storage.
adb shell am force-stop "$pkg"
adb logcat -c
adb shell am start -W -n "$pkg/.MainActivity"
for i in $(seq 1 30); do
  if adb logcat -d -s MezgebStartup:I | grep -Fq 'Bundled interface ready'; then break; fi
  sleep 1
done
adb shell pidof "$pkg"
adb logcat -d -s MezgebStartup:I | grep -F 'Bundled interface ready'
if adb logcat -d -s AndroidRuntime:E | grep -Fq "Process: $pkg"; then exit 1; fi
