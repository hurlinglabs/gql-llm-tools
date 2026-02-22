#!/bin/bash
set -e

PACKAGES=(
  "packages/gql-schema-scout"
  "packages-alias/gql-schema-scout-alias"
)

echo "Validating packages..."
echo ""

for pkg in "${PACKAGES[@]}"; do
  echo "Validating $pkg"
  pnpm exec attw --pack "$pkg" --profile node16
done

echo ""
echo "All packages validated!"
