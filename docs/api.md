# Semantic Lens API Reference

The Semantic Lens view service provides a REST API for graph visualization and pattern detection.

## Base URL

```
http://localhost:3001
```

**Port Configuration:**

The server uses port 3001 by default with dynamic port checking:

- **CLI flag:** `semantic-lens serve --port 8080` (highest priority)
- **Environment variable:** `VIEW_SERVICE_PORT=8080 semantic-lens serve`
- **Default:** Port 3001 (auto-fallback to 3002+ if unavailable)

Explicit ports (CLI flag or env var) fail immediately if unavailable. The default port automatically finds the next available port if 3001 is in use.

## Endpoints

### Health Check

Check if the server is running.

```
GET /health
```

**Response:**

```json
{
  "status": "ok"
}
```

---

### List Views

Get available view types.

```
GET /views
```

**Response:**

```json
{
  "views": ["call_graph", "inheritance", "module_deps", "full"]
}
```

---

### Generate View

Generate a view with layout and optional pattern overlays.

```
POST /view
Content-Type: application/json
```

**Request Body:**

```json
{
  "view": "full",
  "root_id": "node-1",
  "depth": 3,
  "edge_kinds": ["calls", "uses"],
  "min_confidence": 0.5,
  "collapse_kinds": ["method"],
  "exclude_paths": ["node_modules"],
  "include_patterns": true
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `view` | string | Yes | View type: `call_graph`, `inheritance`, `module_deps`, `full` |
| `root_id` | string | No | Root node for subgraph extraction |
| `depth` | number | No | Maximum traversal depth (default: unlimited) |
| `edge_kinds` | string[] | No | Filter edges by kind |
| `min_confidence` | number | No | Minimum edge confidence (0-1) |
| `collapse_kinds` | string[] | No | Node kinds to collapse |
| `exclude_paths` | string[] | No | File path patterns to exclude |
| `include_patterns` | boolean | No | Include pattern overlays |

**Response:**

```json
{
  "elements": {
    "nodes": [
      {
        "data": {
          "id": "node-1",
          "label": "UserService",
          "kind": "class"
        },
        "position": { "x": 100, "y": 200 }
      }
    ],
    "edges": [
      {
        "data": {
          "id": "edge-1",
          "source": "node-1",
          "target": "node-2",
          "kind": "calls"
        }
      }
    ]
  },
  "positions": {
    "node-1": { "x": 100, "y": 200 },
    "node-2": { "x": 300, "y": 200 }
  },
  "patterns": [
    {
      "instanceId": "uuid-1",
      "patternId": "observer",
      "roles": {
        "subject": "node-1",
        "observer": "node-2"
      },
      "confidence": 0.85,
      "evidence": ["Found uses edge"]
    }
  ],
  "stats": {
    "nodeCount": 2,
    "edgeCount": 1,
    "layoutTimeMs": 45
  }
}
```

---

### Compute Layout

Compute ELK layout for provided nodes and edges.

```
POST /layout/elk
Content-Type: application/json
```

**Request Body:**

```json
{
  "nodes": [
    {
      "node_id": "n1",
      "kind": "class",
      "name": "Service",
      "file": "service.ts",
      "route": "app::Service",
      "span": { "start": { "line": 1, "col": 1 }, "end": { "line": 10, "col": 1 } },
      "visibility": "public",
      "language": "typescript"
    }
  ],
  "edges": [
    {
      "edge_id": "e1",
      "kind": "calls",
      "src": "n1",
      "dst": "n2",
      "confidence": 1.0,
      "evidence": ["static_analysis"]
    }
  ]
}
```

**Response:**

```json
{
  "positions": {
    "n1": { "x": 0, "y": 0 },
    "n2": { "x": 200, "y": 0 }
  }
}
```

---

### Run Pattern Detection

Detect patterns in the loaded graph.

```
POST /patterns/run
Content-Type: application/json
```

**Request Body:**

```json
{
  "scope": ["node-1", "node-2", "node-3"]
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scope` | string[] | No | Limit detection to these node IDs |

**Response:**

```json
{
  "patterns": [
    {
      "instanceId": "uuid-1",
      "patternId": "observer",
      "roles": {
        "subject": "class-subject",
        "observer": "interface-observer"
      },
      "confidence": 0.85,
      "evidence": [
        "Found uses edge from subject to observer"
      ],
      "explain": "Observer pattern detected with 85% confidence"
    }
  ]
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

**HTTP Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad request (invalid input) |
| 404 | Not found |
| 500 | Internal server error |

---

## Examples

### cURL Examples

**Validate health:**

```bash
curl http://localhost:3001/health
```

**Generate a full view:**

```bash
curl -X POST http://localhost:3001/view \
  -H "Content-Type: application/json" \
  -d '{"view": "full"}'
```

**Generate a call graph from a specific node:**

```bash
curl -X POST http://localhost:3001/view \
  -H "Content-Type: application/json" \
  -d '{
    "view": "call_graph",
    "root_id": "class-main",
    "depth": 3,
    "include_patterns": true
  }'
```

**Run pattern detection:**

```bash
curl -X POST http://localhost:3001/patterns/run \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Data Types

### Node

```typescript
interface Node {
  node_id: string;
  kind: NodeKind;
  name: string;
  file: string;
  route: string;
  span: Span;
  visibility: Visibility;
  language: string;
  parent?: string;
  docstring?: string;
  signature?: string;
  decorators?: string[];
}
```

### Edge

```typescript
interface Edge {
  edge_id: string;
  kind: EdgeKind;
  src: string;
  dst: string;
  confidence: number;
  evidence: string[];
  call_count?: number;
}
```

### NodeKind

```typescript
type NodeKind =
  | 'module'
  | 'class'
  | 'interface'
  | 'trait'
  | 'function'
  | 'method'
  | 'field'
  | 'property';
```

### EdgeKind

```typescript
type EdgeKind =
  | 'defines'
  | 'imports'
  | 'calls'
  | 'inherits'
  | 'implements'
  | 'uses'
  | 'reads'
  | 'writes'
  | 'throws';
```

### PatternMatch

```typescript
interface PatternMatch {
  instanceId: string;
  patternId: string;
  roles: Record<string, string | string[]>;
  confidence: number;
  evidence: string[];
  explain?: string;
}
```
