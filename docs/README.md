# Semantic Lens

A semantic code graph visualization platform for understanding large codebases.

## Overview

Semantic Lens processes codebase data from external chunkers/analyzers, stores it in a graph database, detects design patterns using declarative rules, and renders interactive architectural diagrams.

### Core Capabilities

- **Schema-validated ingestion** of SemanticGraphBundle payloads
- **Graph storage** with in-memory or Memgraph backends
- **Pattern detection** via YAML DSL with Cypher compilation
- **Interactive visualization** with lenses, filters, and pattern overlays
- **Deterministic layout** using ELK for reproducible diagrams

## Installation

```bash
npm install semantic-lens

# Or install globally for CLI access
npm install -g semantic-lens
```

## Quick Start

### 1. Validate a Bundle

```bash
semantic-lens validate bundle.json
```

### 2. Load and Analyze

```bash
# Load bundle and detect patterns
semantic-lens load bundle.json
semantic-lens patterns --bundle bundle.json --output patterns.json
```

### 3. Start the Visualization Server

```bash
semantic-lens serve --bundle bundle.json
```

Then open http://localhost:3001 in your browser.

**Port Configuration:**

The server uses port 3001 by default and automatically finds the next available port if needed:

```bash
# Use default port (3001, auto-fallback to 3002+ if unavailable)
semantic-lens serve

# Specify port explicitly
semantic-lens serve --port 8080

# Use environment variable
VIEW_SERVICE_PORT=8080 semantic-lens serve
```

## CLI Commands

### validate

Validate a SemanticGraphBundle JSON file against the schema.

```bash
semantic-lens validate <bundle.json>
```

**Exit codes:**
- 0: Valid bundle
- 1: Invalid bundle or error

### load

Load a bundle into the graph store and display statistics.

```bash
semantic-lens load <bundle.json> [options]

Options:
  --db <uri>     Database URI (default: in-memory)
  --clear        Clear store before loading
```

### patterns

Run pattern detection on a loaded graph.

```bash
semantic-lens patterns [options]

Options:
  --bundle <file>    Bundle file to load
  --output <file>    Output file (default: stdout)
  --pattern <id>     Filter by pattern ID
```

**Built-in patterns:**
- `observer` - Observer/Publisher-Subscriber pattern
- `factory` - Factory/Builder pattern
- `singleton` - Singleton pattern
- `strategy` - Strategy/Policy pattern

### serve

Start the HTTP API server for visualization.

```bash
semantic-lens serve [options]

Options:
  --port <port>      Server port (default: 3000)
  --bundle <file>    Pre-load a bundle file
```

### export

Export a view to a static format.

```bash
semantic-lens export <config.json> [options]

Options:
  --format <fmt>     Output format: json (default)
  --output <file>    Output file (default: stdout)
```

## Bundle Format

Semantic Lens accepts SemanticGraphBundle JSON files:

```json
{
  "version": "v1.0",
  "generated_at": "2026-01-01T00:00:00Z",
  "repo": {
    "name": "my-project",
    "commit": "abc123",
    "root": "/path/to/project"
  },
  "nodes": [
    {
      "node_id": "class-user",
      "kind": "class",
      "name": "User",
      "file": "src/models/user.ts",
      "route": "app::models::User",
      "span": {
        "start": { "line": 1, "col": 1 },
        "end": { "line": 50, "col": 1 }
      },
      "visibility": "public",
      "language": "typescript"
    }
  ],
  "edges": [
    {
      "edge_id": "e1",
      "kind": "uses",
      "src": "class-user-service",
      "dst": "class-user",
      "confidence": 0.95,
      "evidence": ["static_analysis"]
    }
  ],
  "annotations": [],
  "patterns": []
}
```

### Node Kinds

- `module` - File or package
- `class` - Class definition
- `interface` - Interface/protocol
- `trait` - Trait/mixin
- `function` - Standalone function
- `method` - Class method
- `field` - Class field/property
- `property` - Property accessor

### Edge Kinds

- `defines` - Parent defines child
- `imports` - Module imports another
- `calls` - Function/method calls another
- `inherits` - Class extends another
- `implements` - Class implements interface
- `uses` - General usage relationship
- `reads` - Reads a field
- `writes` - Writes a field
- `throws` - Throws an exception

## API Reference

See [docs/api.md](api.md) for complete API documentation.

### Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/views` | GET | List available view types |
| `/view` | POST | Generate a view |
| `/layout/elk` | POST | Compute layout only |
| `/patterns/run` | POST | Run pattern detection |

## Pattern DSL

Define custom patterns in YAML:

```yaml
id: observer
description: Observer pattern - subject notifies observers
roles:
  subject:
    kind: class
    name: /Subject|Observable/
  observer:
    kind: interface
    name: /Observer|Listener/
constraints:
  - type: edge
    from: subject
    to: observer
    kind: uses
  - type: group
    role: observer
    min_size: 1
scoring:
  base: 0.6
  weights:
    subject_uses_observer: 0.2
    group_observer: 0.2
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Run with coverage
npm run test:coverage
```

## License

MIT
