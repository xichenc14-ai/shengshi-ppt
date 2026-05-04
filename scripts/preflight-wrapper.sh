#!/bin/bash
# preflight-wrapper.sh — Preflight check entry point
# 确保与 package.json version normalization 兼容

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ============================================================
# Step 0: Parse target_version (may have "v" prefix)
# ============================================================
target_version="${1:-}"
if [[ -z "$target_version" ]]; then
  echo "[ERROR] Usage: preflight-wrapper.sh <target_version>"
  exit 1
fi

# Strip leading "v" for normalization comparison
# e.g. "v10.43" -> "10.43"
target_version_stripped="${target_version#v}"

# ============================================================
# Step 1: Read version from package.json
# ============================================================
if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
  echo "[ERROR] package.json not found at $PROJECT_DIR/package.json"
  exit 1
fi

# Use grep + sed to extract "version": "X.Y" safely (no jq dependency)
package_json_version_raw="$(grep '"version"' "$PROJECT_DIR/package.json" | sed -E 's/.*"version": *"(.[^"]+)".*/\1/' | head -1)"

if [[ -z "$package_json_version_raw" ]]; then
  echo "[ERROR] Could not parse version from package.json"
  exit 1
fi

# Strip leading "v" if present (defensive, shouldn't be in package.json)
package_json_version="${package_json_version_raw#v}"

echo "[INFO] package.json version: $package_json_version"
echo "[INFO] target version (original): $target_version"
echo "[INFO] target version (stripped): $target_version_stripped"

# ============================================================
# Step 2: Version check — compare stripped versions
# ============================================================
version_check=false
if [[ "$package_json_version" == "$target_version_stripped" ]]; then
  version_check=true
fi

echo "[INFO] version_check.match: $version_check"

if [[ "$version_check" != "true" ]]; then
  echo "[ERROR] Version mismatch: package.json='$package_json_version' vs target='$target_version_stripped'"
  exit 1
fi

echo "[OK] Version check passed"

# ============================================================
# Step 3: Continue with other preflight checks (placeholder)
# ============================================================
echo "[INFO] Running remaining preflight checks..."

exit 0