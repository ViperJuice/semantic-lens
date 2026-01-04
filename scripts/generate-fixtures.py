#!/usr/bin/env python3
"""
Generates .slb fixtures for repositories listed in manifest.json using treesitter-chunker.
Usage: python scripts/generate-fixtures.py [--all|--missing]
"""

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

# Add treesitter-chunker to path
sys.path.insert(0, str(Path.home() / "code" / "treesitter-chunker"))

try:
    from chunker import chunk_file
    from chunker.export.formats.semantic_lens import SemanticLensExporter
except ImportError as e:
    print(f"Error importing chunker: {e}")
    print("Make sure treesitter-chunker is installed:")
    print("  cd ~/code/treesitter-chunker && uv pip install -e .")
    sys.exit(1)

# Language detection based on file extension
EXTENSION_TO_LANGUAGE = {
    '.py': 'python',
    '.js': 'javascript',
    '.ts': 'javascript',  # TypeScript uses javascript parser
    '.tsx': 'javascript',
    '.jsx': 'javascript',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.c': 'c',
    '.h': 'c',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.hpp': 'cpp',
    '.rb': 'ruby',
}


def generate_fixture(repo_name: str, repo_path: Path, output_path: Path) -> bool:
    """Generate a .slb fixture for a repository."""
    try:
        print(f"⚙ Generating fixture for {repo_name}...")
        print(f"   Path: {repo_path}")
        print(f"   Output: {output_path}")

        # Process repository
        chunks = []
        relationships = []

        for file_path in repo_path.rglob("*"):
            # Skip hidden files and common ignore patterns
            if any(part.startswith(".") for part in file_path.parts):
                continue
            if not file_path.is_file():
                continue
            if file_path.suffix in [".pyc", ".so", ".dylib", ".dll"]:
                continue

            # Detect language from file extension
            language = EXTENSION_TO_LANGUAGE.get(file_path.suffix.lower())
            if not language:
                continue  # Skip files without known language

            try:
                file_chunks = chunk_file(str(file_path), language)
                chunks.extend(file_chunks)
            except Exception as err:
                # Silently skip unsupported files
                continue

        print(f"   Processed {len(chunks)} chunks")

        # Export to Semantic Lens format
        exporter = SemanticLensExporter()
        exporter.export(chunks, relationships, output_path)

        print(f"✓ Generated {repo_name}.slb ({output_path.stat().st_size} bytes)")
        return True

    except Exception as err:
        print(f"✗ Failed to generate {repo_name}.slb: {err}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate Semantic Lens fixtures")
    parser.add_argument(
        "mode",
        nargs="?",
        default="missing",
        choices=["all", "missing"],
        help="Generation mode (default: missing)",
    )
    args = parser.parse_args()

    # Paths
    project_root = Path(__file__).parent.parent
    fixtures_dir = project_root / "fixtures"
    manifest_file = fixtures_dir / "manifest.json"

    # Load manifest
    if not manifest_file.exists():
        print(f"Error: Manifest not found at {manifest_file}")
        print("Run: node scripts/generate-fixture-manifest.js ~/code")
        sys.exit(1)

    with open(manifest_file) as f:
        manifest = json.load(f)

    print("Semantic Lens Fixture Generator")
    print(f"Mode: {args.mode}")
    print(f"Manifest: {manifest_file}")
    print(f"Output: {fixtures_dir}")
    print()

    # Process repositories
    success_count = 0
    skip_count = 0
    fail_count = 0

    for repo in manifest["repos"]:
        repo_name = repo["name"]
        repo_path = Path(repo["path"])
        has_fixture = repo.get("hasFixture", False)
        fixture_path = fixtures_dir / f"{repo_name}.slb"

        # Skip if fixture exists and mode is "missing"
        if args.mode == "missing" and has_fixture:
            print(f"⊘ Skipping {repo_name} (fixture exists)")
            skip_count += 1
            continue

        # Skip if repo directory doesn't exist
        if not repo_path.exists():
            print(f"✗ Skipping {repo_name} (directory not found: {repo_path})")
            skip_count += 1
            continue

        # Generate fixture
        if generate_fixture(repo_name, repo_path, fixture_path):
            success_count += 1
        else:
            fail_count += 1

        print()

    # Summary
    print("Done!")
    print(f"  Generated: {success_count}")
    print(f"  Skipped: {skip_count}")
    print(f"  Failed: {fail_count}")
    print()
    print("Run: node scripts/generate-fixture-manifest.js ~/code")
    print("     to update the manifest with new fixtures")


if __name__ == "__main__":
    main()
