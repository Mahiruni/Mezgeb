#!/usr/bin/env bash
# Run on the owner-controlled machine. Never print or commit signing secrets.
set -euo pipefail
repo="Mahiruni/Mezgeb"
for cmd in gh keytool openssl base64; do command -v "$cmd" >/dev/null || { echo "Missing $cmd"; exit 1; }; done
gh auth status >/dev/null
mode="${1:-}"
file="${2:-}"
alias="${3:-mezgeb}"
if [[ "$mode" != "--existing" && "$mode" != "--new" ]] || [[ -z "$file" ]]; then
  echo "Usage: bash scripts/configure-android-signing.sh --existing /private/path/mezgeb.p12 [alias]"
  echo "       bash scripts/configure-android-signing.sh --new /private/path/mezgeb.p12 [alias]"
  echo "Use --new only for a new signing identity; it cannot replace old APKs with a different certificate."
  exit 1
fi
umask 077
read -rsp "Keystore password: " STORE_PASSWORD; echo
[[ ${#STORE_PASSWORD} -ge 12 ]] || { echo "Use at least 12 characters."; exit 1; }
export STORE_PASSWORD
if [[ "$mode" == "--new" ]]; then
  [[ ! -e "$file" ]] || { echo "Refusing to overwrite existing key."; exit 1; }
  read -rp "Type NEW-IDENTITY to confirm old APKs may not accept updates: " confirmation
  [[ "$confirmation" == "NEW-IDENTITY" ]] || exit 1
  keytool -genkeypair -storetype PKCS12 -keystore "$file" -alias "$alias" -keyalg RSA -keysize 3072 -validity 10950 -dname "CN=Mezgeb, O=Hisab Technologies" -storepass:env STORE_PASSWORD -keypass:env STORE_PASSWORD
  KEY_PASSWORD="$STORE_PASSWORD"
else
  [[ -f "$file" ]] || { echo "Keystore missing."; exit 1; }
  read -rsp "Key password (Enter if same as keystore): " KEY_PASSWORD; echo
  KEY_PASSWORD="${KEY_PASSWORD:-$STORE_PASSWORD}"
fi
export KEY_PASSWORD
CERT=$(keytool -exportcert -keystore "$file" -alias "$alias" -storepass:env STORE_PASSWORD | openssl dgst -sha256 -r | awk '{print $1}')
[[ "$CERT" =~ ^[a-f0-9]{64}$ ]] || { echo "Could not read signing certificate."; exit 1; }
echo "Signing certificate SHA-256: $CERT"
read -rp "For an in-place upgrade, enter the installed APK certificate SHA-256 (or NEW for fresh installs only): " expected
expected=$(printf '%s' "$expected" | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')
if [[ "$expected" != "$CERT" && "$expected" != "new" ]]; then echo "Certificate mismatch. No secrets uploaded."; exit 1; fi
if [[ "$expected" == "new" ]]; then echo "New identity only. Do not uninstall old Mezgeb until a verified ledger backup exists."; fi
base64 < "$file" | tr -d '\n' | gh secret set MEZGEB_ANDROID_KEYSTORE_BASE64 --repo "$repo"
printf '%s' "$STORE_PASSWORD" | gh secret set MEZGEB_ANDROID_KEYSTORE_PASSWORD --repo "$repo"
printf '%s' "$KEY_PASSWORD" | gh secret set MEZGEB_ANDROID_KEY_PASSWORD --repo "$repo"
printf '%s' "$alias" | gh secret set MEZGEB_ANDROID_KEY_ALIAS --repo "$repo"
gh variable set MEZGEB_ANDROID_CERT_SHA256 --repo "$repo" --body "$CERT"
unset STORE_PASSWORD KEY_PASSWORD
echo "Signing credentials configured. Keep an encrypted offline copy of your keystore. Run the Android full release workflow."
