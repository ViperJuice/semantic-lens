## 1) Formal JSON Schemas (IR v1)

### 1.1 Graph bundle schema (top-level)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://consiliency.dev/schemas/semantic-graph-bundle.schema.json",
  "title": "SemanticGraphBundle",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "generated_at", "nodes", "edges", "annotations", "patterns"],
  "properties": {
    "version": { "type": "string", "pattern": "^v\\d+\\.\\d+$" },
    "generated_at": { "type": "string", "format": "date-time" },
    "repo": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "name": { "type": "string" },
        "commit": { "type": "string" },
        "root": { "type": "string" }
      }
    },
    "nodes": {
      "type": "array",
      "items": { "$ref": "#/$defs/Node" }
    },
    "edges": {
      "type": "array",
      "items": { "$ref": "#/$defs/Edge" }
    },
    "annotations": {
      "type": "array",
      "items": { "$ref": "#/$defs/Annotation" }
    },
    "patterns": {
      "type": "array",
      "items": { "$ref": "#/$defs/PatternInstance" }
    }
  },
  "$defs": {
    "NodeKind": {
      "type": "string",
      "enum": ["module", "class", "interface", "trait", "function", "method", "field", "property"]
    },
    "Visibility": {
      "type": "string",
      "enum": ["public", "protected", "private", "unknown"]
    },
    "EdgeKind": {
      "type": "string",
      "enum": ["defines", "imports", "calls", "inherits", "implements", "uses", "reads", "writes", "throws"]
    },
    "Evidence": {
      "type": "string",
      "enum": ["chunker", "lsp", "static_analysis", "heuristic", "llm_score"]
    },
    "Span": {
      "type": "array",
      "minItems": 2,
      "maxItems": 2,
      "items": { "type": "integer", "minimum": 0 }
    },
    "Node": {
      "type": "object",
      "additionalProperties": false,
      "required": ["node_id", "kind", "name", "language", "file", "span"],
      "properties": {
        "node_id": { "type": "string", "minLength": 8 },
        "kind": { "$ref": "#/$defs/NodeKind" },
        "name": { "type": "string" },
        "language": { "type": "string" },
        "file": { "type": "string" },
        "span": { "$ref": "#/$defs/Span" },
        "parent": { "type": "string" },
        "route": { "type": "string", "description": "Stable hierarchical path, e.g., pkg.mod::Class::method" },
        "visibility": { "$ref": "#/$defs/Visibility" },
        "signature": { "type": "string" },
        "doc_hash": { "type": "string" }
      }
    },
    "Edge": {
      "type": "object",
      "additionalProperties": false,
      "required": ["edge_id", "kind", "src", "dst", "confidence", "evidence"],
      "properties": {
        "edge_id": { "type": "string", "minLength": 8 },
        "kind": { "$ref": "#/$defs/EdgeKind" },
        "src": { "type": "string" },
        "dst": { "type": "string" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 },
        "evidence": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/$defs/Evidence" }
        },
        "meta": { "type": "object", "additionalProperties": true }
      }
    },
    "Annotation": {
      "type": "object",
      "additionalProperties": false,
      "required": ["target_id", "tags"],
      "properties": {
        "target_id": { "type": "string" },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        },
        "kv": {
          "type": "object",
          "additionalProperties": { "type": ["string", "number", "boolean", "null"] }
        }
      }
    },
    "PatternRoleBinding": {
      "type": "object",
      "additionalProperties": { "type": "string" },
      "description": "role_name -> node_id"
    },
    "PatternInstance": {
      "type": "object",
      "additionalProperties": false,
      "required": ["instance_id", "pattern_id", "roles", "confidence", "evidence"],
      "properties": {
        "instance_id": { "type": "string" },
        "pattern_id": { "type": "string" },
        "roles": { "$ref": "#/$defs/PatternRoleBinding" },
        "confidence": { "type": "number", "minimum": 0.0, "maximum": 1.0 },
        "evidence": { "type": "array", "items": { "type": "string" } },
        "explain": { "type": "string" }
      }
    }
  }
}
```

### 1.2 Conventions you should enforce (determinism)

* `node_id` = chunker ID (no new IDs for base nodes).
* `edge_id` = stable hash of `(kind, src, dst, normalized-meta)` with a fixed ordering.
* `route` is optional but recommended for human display and cross-tool lookup.

---

## 2) Cypher / graph queries to detect patterns (Memgraph/Neo4j-style)

### 2.1 Graph storage model (recommended)

* Store nodes as `(:Sym {node_id, kind, name, file, language, route, visibility})`
* Store edges as relationships with `kind` baked into relationship type (fast) or a `kind` property (flexible).

I recommend **relationship types** (fast + expressive):

* `(:Sym)-[:CALLS]->(:Sym)`
* `(:Sym)-[:DEFINES]->(:Sym)`
* `(:Sym)-[:IMPLEMENTS]->(:Sym)`
* `(:Sym)-[:INHERITS]->(:Sym)`
* `(:Sym)-[:USES]->(:Sym)`

Also store `confidence` on relationships:

* `r.confidence`, `r.evidence`

---

### 2.2 Observer (heuristic detection)

Definition (practical): a Subject class calls the same method on many Observers, often from a `notify`-like method, and Observers implement/extend a common base.

**Query A: find fan-out “notify” methods**

```cypher
MATCH (subject:Sym {kind:'class'})-[:DEFINES]->(notify:Sym {kind:'method'})
MATCH (notify)-[c:CALLS]->(obsMethod:Sym {kind:'method'})
MATCH (observer:Sym)-[:DEFINES]->(obsMethod)
WITH subject, notify, observer, count(DISTINCT obsMethod) AS methodsCalled, count(c) AS callCount
WHERE callCount >= 2
RETURN subject.node_id AS subject_id, notify.node_id AS notify_id,
       collect(DISTINCT observer.node_id) AS observers,
       callCount, methodsCalled
ORDER BY callCount DESC
LIMIT 50;
```

**Query B: observers share a common interface/base**

```cypher
MATCH (subject:Sym {kind:'class'})-[:DEFINES]->(notify:Sym {kind:'method'})
MATCH (notify)-[:CALLS]->(obsMethod:Sym {kind:'method'})
MATCH (observer:Sym)-[:DEFINES]->(obsMethod)
MATCH (observer)-[:IMPLEMENTS|INHERITS]->(base:Sym)
WITH subject, notify, base, collect(DISTINCT observer) AS obs
WHERE size(obs) >= 2
RETURN subject.node_id AS subject_id, notify.node_id AS notify_id,
       base.node_id AS observer_base_id, [o IN obs | o.node_id] AS observers;
```

---

### 2.3 Strategy (runtime selection via interface + multiple implementations + calls via abstraction)

```cypher
// interface with multiple implementations
MATCH (iface:Sym {kind:'interface'})<-[:IMPLEMENTS]-(impl:Sym {kind:'class'})
WITH iface, collect(DISTINCT impl) AS impls
WHERE size(impls) >= 2
// a context uses the interface and calls methods on it
MATCH (ctx:Sym {kind:'class'})-[:USES]->(iface)
MATCH (ctx)-[:DEFINES]->(m:Sym {kind:'method'})-[:CALLS]->(called:Sym {kind:'method'})
MATCH (iface)-[:DEFINES]->(ifaceMethod:Sym {kind:'method'})
WHERE called.node_id = ifaceMethod.node_id OR called.name = ifaceMethod.name
RETURN iface.node_id AS strategy_iface,
       [i IN impls | i.node_id] AS implementations,
       ctx.node_id AS context_class,
       m.node_id AS context_method;
```

---

### 2.4 Factory Method (creator class returns/constructs product interface with multiple concrete products)

You can approximate without full type inference:

* a `create*`/`new*` method on Creator
* it calls constructors of multiple classes that implement a Product interface

```cypher
MATCH (creator:Sym {kind:'class'})-[:DEFINES]->(factory:Sym {kind:'method'})
WHERE toLower(factory.name) CONTAINS 'create' OR toLower(factory.name) CONTAINS 'build'
MATCH (factory)-[:CALLS]->(ctor:Sym {kind:'method'})
WHERE toLower(ctor.name) IN ['__init__','constructor','new'] OR toLower(ctor.name) CONTAINS 'init'
MATCH (productClass:Sym {kind:'class'})-[:DEFINES]->(ctor)
MATCH (productClass)-[:IMPLEMENTS|INHERITS]->(productBase:Sym)
WITH creator, factory, productBase, collect(DISTINCT productClass) AS products
WHERE size(products) >= 2
RETURN creator.node_id AS creator_id,
       factory.node_id AS factory_method_id,
       productBase.node_id AS product_base_id,
       [p IN products | p.node_id] AS concrete_products;
```

---

### 2.5 Singleton (practical structural signals)

Signals:

* class has a static/global “instance”
* constructor is private/protected (language-dependent)
* has `getInstance`-like method returning instance
* instantiation occurs once (hard without runtime)

A workable heuristic:

```cypher
MATCH (cls:Sym {kind:'class'})-[:DEFINES]->(m:Sym {kind:'method'})
WHERE toLower(m.name) IN ['getinstance','instance']
WITH cls, m
MATCH (m)-[:READS|WRITES|USES]->(field:Sym {kind:'field'})
WHERE toLower(field.name) CONTAINS 'instance'
RETURN cls.node_id AS singleton_class, m.node_id AS accessor_method, field.node_id AS instance_field;
```

---

### 2.6 Turning query results into PatternInstances

For each match, emit:

* `pattern_id`
* `roles` mapping role names to `node_id`
* `confidence` based on how many constraints satisfied

---

## 3) Pattern DSL (declarative rules) + compilation strategy

### 3.1 DSL goals

* Language-agnostic
* Expressible as **subgraph constraints**
* Produces either:

  * Cypher queries, or
  * an in-memory matcher over your IR graph

### 3.2 YAML DSL v1

```yaml
version: v1.0
patterns:
  - id: observer
    roles:
      subject: { kind: class }
      notify:   { kind: method, owned_by: subject }
      observer: { kind: class }
      update:   { kind: method, owned_by: observer }
    constraints:
      - type: edge
        kind: CALLS
        from: notify
        to: update
      - type: group
        role: observer
        min_size: 2
      - type: optional
        constraint:
          type: edge
          kind: IMPLEMENTS
          from: observer
          to_any:
            kind: interface
            bind_as: observer_base
    scoring:
      base: 0.4
      weights:
        calls_notify_update: 0.3
        multiple_observers: 0.2
        has_observer_base: 0.1
```

### 3.3 Compilation approach (deterministic)

1. Convert role specs into `MATCH` clauses.
2. Convert edge constraints into relationship patterns.
3. Convert groups into `WITH ... collect(...) WHERE size(...) >= N`.
4. Convert optionals into `OPTIONAL MATCH` and add scoring if present.

### 3.4 Example: compiled Cypher skeleton (observer)

```cypher
MATCH (subject:Sym {kind:'class'})-[:DEFINES]->(notify:Sym {kind:'method'})
MATCH (notify)-[:CALLS]->(update:Sym {kind:'method'})
MATCH (observer:Sym {kind:'class'})-[:DEFINES]->(update)
WITH subject, notify, collect(DISTINCT observer) AS observers
WHERE size(observers) >= 2
OPTIONAL MATCH (observer)-[:IMPLEMENTS]->(observerBase:Sym {kind:'interface'})
RETURN subject, notify, observers, observerBase;
```

### 3.5 In-memory matcher variant (better if you want speed + portability)

* Pre-index nodes by `(kind, name_tokens, route_prefix)`
* Pre-index adjacency by `edge_kind`
* Pattern constraint solver does:

  * role binding search
  * constraint pruning
  * score aggregation
    This avoids DB dependency for client-side diagramming.

---

## 4) Mapping to Cytoscape + ELK (interactive + deterministic)

### 4.1 Data flow

1. **Base nodes** from chunker → Cytoscape elements
2. **Edges** (calls/imports/inherits/implements/uses) → Cytoscape edges
3. **PatternInstances** → overlay “meta elements” (optional)

### 4.2 Cytoscape element format

```js
const elements = {
  nodes: [
    { data: { id: node_id, kind, name, file, language, parent } }
  ],
  edges: [
    { data: { id: edge_id, source: src, target: dst, kind, confidence } }
  ]
};
```

### 4.3 Deterministic layout with ELK

Use ELK as a layout service:

* input: current view graph (subset of nodes/edges)
* output: x/y positions per node

Workflow:

1. Build “view graph” deterministically (projection).
2. Send to ELK with stable ordering.
3. Apply returned positions to Cytoscape (or render directly).

Example ELK request (layered layout):

```json
{
  "id": "root",
  "layoutOptions": {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.layered.spacing.nodeNodeBetweenLayers": "40",
    "elk.spacing.nodeNode": "25"
  },
  "children": [
    { "id": "nodeA", "width": 160, "height": 40 },
    { "id": "nodeB", "width": 160, "height": 40 }
  ],
  "edges": [
    { "id": "e1", "sources": ["nodeA"], "targets": ["nodeB"] }
  ]
}
```

### 4.4 Interaction model (what to implement)

* **Expand/collapse**: user clicks node → projection adds owned children (`DEFINES` edges) or hides them.
* **Lenses**: toggles that filter edge kinds and/or require tags.
* **Pattern overlay**: enable “patterns” → draw hulls/groups for each PatternInstance:

  * Render as compound nodes or bounding boxes (Cytoscape extensions can help), or
  * Add a separate “pattern layer” UI panel listing instances; clicking highlights role nodes.

### 4.5 Incremental updates (fast)

When code changes:

1. chunker updates affected nodes (stable IDs for unchanged)
2. update graph store
3. recompute only impacted edges (local rebuild)
4. update view projection
5. re-run ELK on impacted connected component (not whole graph)

### 4.6 View definitions (API surface)

Define a simple HTTP/IPC API:

* `GET /views` (available view types)
* `POST /view` with ViewConfig → returns `{elements, layoutHints}`
* `POST /layout/elk` optional if layout server runs separately
* `POST /patterns/run` to compute PatternInstances for a scope

Example view config (call graph bounded):

```json
{
  "view": "call_graph",
  "root_id": "chunk_fn_process_order",
  "depth": 2,
  "edge_kinds": ["calls"],
  "min_confidence": 0.6,
  "collapse_kinds": ["method"],
  "exclude_paths": ["**/tests/**"]
}
```

---

## Implementation order (literal next steps)

1. Implement schema validation (bundle → JSON Schema).
2. Build DB loader (nodes + edges into Memgraph/Neo4j labels/rel-types).
3. Implement 3–5 pattern rules in DSL and compile to Cypher.
4. Build view service that:

   * projects subgraphs deterministically
   * calls ELK
   * returns Cytoscape elements + positions
5. Add pattern overlay UI and “confidence slider.”

If you paste (or describe) your chunk payload structure (fields + IDs), I can align the schemas and the loader precisely to your repo’s actual output without guessing.
