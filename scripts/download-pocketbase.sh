#!/usr/bin/env sh
# Downloads the pinned PocketBase binary into ./pocketbase for local development.
# The Docker image uses the same version (see POCKETBASE_VERSION in the Dockerfile).
set -eu

VERSION="${POCKETBASE_VERSION:-0.40.5}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/pocketbase"

case "$(uname -s)" in
  Darwin) OS=darwin ;;
  Linux) OS=linux ;;
  *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) ARCH=arm64 ;;
  x86_64|amd64) ARCH=amd64 ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

if [ -x "$DIR/pocketbase" ] && "$DIR/pocketbase" --version | grep -q "$VERSION"; then
  echo "PocketBase $VERSION already present."
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
URL="https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_${OS}_${ARCH}.zip"
echo "Downloading $URL"
curl -fsSL "$URL" -o "$TMP/pb.zip"
unzip -q -o "$TMP/pb.zip" pocketbase -d "$TMP"
mv "$TMP/pocketbase" "$DIR/pocketbase"
chmod +x "$DIR/pocketbase"
echo "PocketBase $VERSION installed to $DIR/pocketbase"
