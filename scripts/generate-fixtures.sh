#!/bin/bash
##
# Generates .slb fixtures for repositories listed in manifest.json
# Usage: ./scripts/generate-fixtures.sh [--all|--missing]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FIXTURES_DIR="$PROJECT_ROOT/fixtures"
MANIFEST_FILE="$FIXTURES_DIR/manifest.json"
CHUNKER_PATH="$HOME/code/treesitter-chunker"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if manifest exists
if [ ! -f "$MANIFEST_FILE" ]; then
  echo -e "${RED}Error: Manifest not found at $MANIFEST_FILE${NC}"
  echo "Run: node scripts/generate-fixture-manifest.js ~/code"
  exit 1
fi

# Check if treesitter-chunker exists
if [ ! -d "$CHUNKER_PATH" ]; then
  echo -e "${RED}Error: treesitter-chunker not found at $CHUNKER_PATH${NC}"
  exit 1
fi

# Parse options
MODE="missing"  # Default: only generate missing fixtures
if [ "$1" == "--all" ]; then
  MODE="all"
elif [ "$1" == "--missing" ]; then
  MODE="missing"
fi

echo -e "${GREEN}Semantic Lens Fixture Generator${NC}"
echo "Mode: $MODE"
echo "Manifest: $MANIFEST_FILE"
echo "Output: $FIXTURES_DIR"
echo ""

# Read repos from manifest and generate fixtures
jq -r '.repos[] | @json' "$MANIFEST_FILE" | while read -r repo_json; do
  repo_name=$(echo "$repo_json" | jq -r '.name')
  repo_path=$(echo "$repo_json" | jq -r '.path')
  has_fixture=$(echo "$repo_json" | jq -r '.hasFixture')
  fixture_path="$FIXTURES_DIR/${repo_name}.slb"

  # Skip if fixture exists and mode is "missing"
  if [ "$MODE" == "missing" ] && [ "$has_fixture" == "true" ]; then
    echo -e "${YELLOW}⊘${NC} Skipping $repo_name (fixture exists)"
    continue
  fi

  # Skip if repo directory doesn't exist
  if [ ! -d "$repo_path" ]; then
    echo -e "${RED}✗${NC} Skipping $repo_name (directory not found: $repo_path)"
    continue
  fi

  echo -e "${GREEN}⚙${NC} Generating fixture for $repo_name..."
  echo "   Path: $repo_path"
  echo "   Output: $fixture_path"

  # Run treesitter-chunker
  (
    cd "$CHUNKER_PATH"
    python3 -m chunker "$repo_path" \
      --format semantic-lens \
      --output "$fixture_path" \
      2>&1 | sed 's/^/   /'
  ) && {
    echo -e "${GREEN}✓${NC} Generated $repo_name.slb"
  } || {
    echo -e "${RED}✗${NC} Failed to generate $repo_name.slb"
  }

  echo ""
done

echo -e "${GREEN}Done!${NC}"
echo "Run: node scripts/generate-fixture-manifest.js ~/code"
echo "     to update the manifest with new fixtures"
