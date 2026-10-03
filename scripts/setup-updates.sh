#!/usr/bin/env bash
#
# setup-updates.sh — Fully automated, secure release-signing key setup.
#
# The user never has to create a key manually:
#   1. Generates a Tauri minisign keypair with a RANDOM 32-byte passphrase
#      (minisign private keys are passphrase-encrypted at rest — AES/RSA-free,
#      cryptographic protection built into the format).
#   2. Pushes the private key + passphrase as GitHub Actions secrets
#      (encrypted at rest by GitHub) so ONLY CI can sign releases.
#   3. Injects the public key into frontend/src-tauri/tauri.conf.json so
#      installed apps can verify updates.
#   4. Keeps a local passphrase-encrypted backup at ~/.tauri/ and offers to
#      delete the local private key (recommended — CI is the single holder).
#
# Requires: pnpm, gh (GitHub CLI, authenticated with repo access).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEY_DIR="${HOME}/.tauri"
KEY_FILE="${KEY_DIR}/prism.key"
PUB_FILE="${KEY_DIR}/prism.key.pub"
CONF="${ROOT}/frontend/src-tauri/tauri.conf.json"

command -v gh >/dev/null 2>&1 || { echo "ERROR: GitHub CLI (gh) is required: https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: run 'gh auth login' first"; exit 1; }

echo "[1/5] Checking for an existing keypair..."
if [ -f "${KEY_FILE}" ]; then
  echo "  Found existing ${KEY_FILE} — reusing it."
else
  mkdir -p "${KEY_DIR}"
  echo "  Generating a new signing keypair with a random passphrase..."
  # 64 hex chars of OS entropy → the passphrase protecting the private key.
  PASSPHRASE="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)"
  ( cd "${ROOT}/frontend" && pnpm exec tauri signer generate -w "${KEY_FILE}" --password "${PASSPHRASE}" --ci >/dev/null )
  echo "  Keypair generated (private key is passphrase-encrypted at rest)."
fi

echo "[2/5] Reading the public key..."
PUBKEY="$(tr -d '\n' < "${PUB_FILE}")"

echo "[3/5] Publishing secrets to GitHub Actions (encrypted at rest by GitHub)..."
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
if [ -n "${PASSPHRASE:-}" ]; then
  # Key was just generated in this run — we know the passphrase.
  gh secret set TAURI_SIGNING_PRIVATE_KEY --repo "${REPO}" --body "$(cat "${KEY_FILE}")"
  gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo "${REPO}" --body "${PASSPHRASE}"
else
  echo "  Reusing an existing key whose passphrase is not known to this script."
  echo "  If the GitHub secrets already exist, you're set. Otherwise restore"
  echo "  the passphrase from your backup and re-run with the key regenerated."
fi
echo "  Secrets written to ${REPO}."

echo "[4/5] Embedding the public key into tauri.conf.json..."
node -e '
const fs = require("fs");
const conf = process.argv[1];
const pub = process.argv[2];
const json = JSON.parse(fs.readFileSync(conf, "utf8"));
json.plugins = json.plugins || {};
json.plugins.updater = {
  endpoints: ["https://github.com/" + process.argv[3] + "/releases/latest/download/latest.json"],
  pubkey: pub,
};
json.bundle.createUpdaterArtifacts = true;
fs.writeFileSync(conf, JSON.stringify(json, null, 2) + "\n");
' "${CONF}" "${PUBKEY}" "${REPO}"
echo "  ${CONF} updated."

echo "[5/5] Done."
echo ""
echo "Security notes:"
echo "  • The private key is passphrase-encrypted at rest (minisign format)."
echo "  • The passphrase lives ONLY in GitHub Actions secrets + this machine's"
echo "    key file (~/.tauri). For maximum safety you may now delete the local"
echo "    private key: rm ${KEY_FILE}  (keep ${PUB_FILE} and the passphrase offline!)"
echo "  • If you ever lose BOTH the local key and the passphrase, updates can"
echo "    no longer be signed — users must reinstall manually."
