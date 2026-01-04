# Semantic Lens Fixtures

This directory contains `.slb` (Semantic Lens Bundle) files - pre-analyzed code graphs for demo and testing.

## What are Fixtures?

Fixtures are semantic graph bundles generated from analyzing codebases with `treesitter-chunker`. Each `.slb` file contains:
- **Nodes**: Code entities (modules, classes, functions, etc.)
- **Edges**: Relationships between entities (calls, imports, inheritance)
- **Metadata**: File paths, line numbers, confidence scores

## Fixture Workflow

### 1. Scan for Repositories
Discover all git repos in `~/code`:

```bash
node scripts/generate-fixture-manifest.js ~/code
```

This creates `fixtures/manifest.json` listing all repositories.

### 2. Generate Fixtures
Create `.slb` files for repos using `treesitter-chunker`:

```bash
# Generate only missing fixtures (default)
./scripts/generate-fixtures.sh

# Regenerate all fixtures
./scripts/generate-fixtures.sh --all
```

**Requirements:**
- `treesitter-chunker` installed at `~/code/treesitter-chunker`
- Python 3 with dependencies installed
- `jq` command-line JSON processor

### 3. Update Manifest
After generating fixtures, refresh the manifest:

```bash
node scripts/generate-fixture-manifest.js ~/code
```

This updates the `hasFixture` flags in the manifest.

### 4. Select Repos in UI
Open `demo-sigma.html` in browser:
1. The "Repository Sources" section loads from `manifest.json`
2. Check/uncheck repos to control which appear in the fixture dropdown
3. Selections are saved in browser localStorage
4. Only repos with fixtures (✓) are selectable

## Manual Fixture Creation

To generate a single fixture manually:

```bash
cd ~/code/treesitter-chunker
python3 -m chunker /path/to/repo \
  --format semantic-lens \
  --output ~/code/semantic-lens/fixtures/repo-name.slb
```

## Existing Fixtures

- **semantic-lens-v4.slb** (379KB) - Semantic Lens v4 codebase
- **navblue-extension.slb** (4.7KB) - NavBlue extension project

## Architecture

```
┌─────────────────┐
│  Source Code    │
│  (Git Repos)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ treesitter-     │─────▶│  Fixtures/       │
│ chunker         │      │  *.slb files     │
│                 │      └────────┬─────────┘
│ (External Tool) │               │
└─────────────────┘               │
                                  ▼
                        ┌──────────────────┐
                        │ Semantic Lens    │
                        │ (Visualization)  │
                        └──────────────────┘
```

## Troubleshooting

### `treesitter-chunker` not found
Install it:
```bash
cd ~/code
git clone https://github.com/Consiliency/treesitter-chunker
cd treesitter-chunker
pip install -e .
```

### `ModuleNotFoundError: No module named 'tree_sitter'`
Install dependencies:
```bash
cd ~/code/treesitter-chunker
pip install -r requirements.txt
```

### `jq: command not found`
Install jq:
```bash
# Ubuntu/Debian
sudo apt install jq

# macOS
brew install jq
```

## File Format

`.slb` files are JSON files following the `SemanticGraphBundle` schema:

```json
{
  "schema_version": "0.2.0",
  "metadata": { ... },
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

See `src/schema/semantic-graph-bundle.schema.json` for full specification.
