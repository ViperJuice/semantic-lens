# Issue: Add tree-sitter-language-pack as fallback grammar provider

**Status:** Open
**Priority:** Medium
**Related:** https://github.com/Consiliency/treesitter-chunker/issues/51

## Context

treesitter-chunker (our dependency for code parsing) doesn't include pre-compiled grammars
in its PyPI distribution. We've submitted an issue (#51) requesting they add `tree-sitter-language-pack`
as a dependency, but we need a fallback in case they don't.

## Problem

When installing treesitter-chunker from PyPI and attempting to use it:

```
Language 'typescript' not found. No languages available (check library compilation)
```

This blocks the semantic-lens ingestion pipeline from working out of the box.

## Proposed Solution

Add `tree-sitter-language-pack` as a direct dependency in semantic-lens:

```toml
# pyproject.toml (if we add Python tooling)
dependencies = [
    "tree-sitter-language-pack>=0.4.0",
]
```

Or for the TypeScript CLI, create a Python subprocess wrapper that uses tree-sitter-language-pack
when treesitter-chunker fails to find grammars:

```python
# scripts/chunker-adapter.py
try:
    from chunker import chunk_file
    result = chunk_file(path, language=lang)
except Exception as e:
    if "No languages available" in str(e):
        # Fallback to direct tree-sitter-language-pack usage
        from tree_sitter_language_pack import get_language, get_parser
        parser = get_parser(lang)
        # Parse directly...
```

## Acceptance Criteria

- [ ] Works on fresh install without manual grammar setup
- [ ] Fallback activates automatically when treesitter-chunker grammars unavailable
- [ ] Supports at least: TypeScript, JavaScript, Python, Rust, Go
- [ ] Tests verify both primary and fallback paths

## Notes

- Monitor https://github.com/Consiliency/treesitter-chunker/issues/51 for upstream fix
- If upstream fixes within reasonable time, this issue can be closed
- `tree-sitter-language-pack` provides 165+ pre-compiled grammars
