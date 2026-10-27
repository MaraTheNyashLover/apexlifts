#!/usr/bin/env bash
# Packs signing material into ci/secrets.tar.enc. Usage:
#   BUNDLE_KEY=... tools/pack-secrets.sh <dir containing AuthKey_*.p8, signing.p12, env>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$1"
tar -c AuthKey_*.p8 signing.p12 env | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BUNDLE_KEY -out "$ROOT/ci/secrets.tar.enc"
ls -l "$ROOT/ci/secrets.tar.enc"
