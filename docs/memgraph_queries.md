# Memgraph Analysis Queries for Semantic Lens

Reference queries for analyzing SemanticGraphBundle data in Memgraph Lab.

## Graph Statistics

```cypher
-- Total nodes by kind
MATCH (n:Sym) RETURN n.kind AS kind, count(n) AS count ORDER BY count DESC;

-- Total edges by type
MATCH ()-[r]->() RETURN type(r) AS rel, count(r) AS cnt ORDER BY cnt DESC;

-- Bundle overview
MATCH (n:Sym) WITH count(n) AS nodes
MATCH ()-[r]->() WITH nodes, count(r) AS edges
RETURN nodes, edges;
```

## Isolates (Degree = 0)

Nodes with no connections - potential dead code or missing edges.

```cypher
-- All isolates
MATCH (n:Sym) WHERE degree(n) = 0
RETURN n.kind, n.name, n.file
LIMIT 200;

-- Isolate counts by kind
MATCH (n:Sym) WHERE degree(n) = 0
RETURN n.kind AS kind, count(n) AS isolates
ORDER BY isolates DESC;
```

## Vestigial Candidates

Isolates that are likely dead code (excluding test files).

```cypher
MATCH (n:Sym)
WHERE degree(n) = 0
  AND NOT n.file CONTAINS '/test'
  AND NOT n.file CONTAINS '/fixtures'
  AND NOT n.file CONTAINS '.test.'
  AND NOT n.file CONTAINS '.spec.'
  AND NOT n.file CONTAINS '__tests__'
RETURN n.kind, n.name, n.file
ORDER BY n.file, n.kind
LIMIT 200;
```

## Top Hubs (Highest Degree)

Most connected nodes - key architectural elements.

```cypher
MATCH (n:Sym)
RETURN n.id, n.kind, n.name, n.file, degree(n) AS deg
ORDER BY deg DESC LIMIT 50;

-- Separate in/out degree
MATCH (n:Sym)
RETURN n.name, n.kind, n.file,
       size((n)<--()) AS in_degree,
       size((n)-->()) AS out_degree,
       degree(n) AS total
ORDER BY total DESC LIMIT 30;
```

## Synthetic vs Semantic Edges

Distinguish machine-detected from statically-analyzed edges.

```cypher
-- Summary
MATCH ()-[r]->()
RETURN coalesce(r.synthetic, false) AS synthetic, count(r) AS cnt;

-- Synthetic edges only
MATCH (a:Sym)-[r]->(b:Sym)
WHERE r.synthetic = true
RETURN a.name, type(r), b.name, r.confidence, r.evidence
LIMIT 100;

-- Low confidence edges
MATCH (a:Sym)-[r]->(b:Sym)
WHERE r.confidence < 0.9
RETURN a.name, type(r), b.name, r.confidence
ORDER BY r.confidence ASC
LIMIT 50;
```

## Cross-File Coupling

Files that heavily depend on each other.

```cypher
-- Cross-file call hotspots
MATCH (a:Sym)-[r:CALLS]->(b:Sym)
WHERE a.file <> b.file AND coalesce(r.synthetic, false) = false
RETURN a.file AS caller_file, b.file AS callee_file, count(r) AS calls
ORDER BY calls DESC LIMIT 50;

-- All cross-file relationships
MATCH (a:Sym)-[r]->(b:Sym)
WHERE a.file <> b.file AND coalesce(r.synthetic, false) = false
RETURN a.file, b.file, type(r) AS rel, count(r) AS cnt
ORDER BY cnt DESC LIMIT 50;
```

## Module Analysis

```cypher
-- Module dependency graph
MATCH (a:Sym:Module)-[r:IMPORTS]->(b:Sym:Module)
RETURN a.name AS from_module, b.name AS to_module, count(r) AS import_count
ORDER BY import_count DESC;

-- Modules with most symbols
MATCH (m:Sym:Module)<-[:DEFINES*]-(s:Sym)
RETURN m.name, m.file, count(s) AS symbols
ORDER BY symbols DESC LIMIT 20;
```

## Class Analysis

```cypher
-- Classes with most methods
MATCH (c:Sym:Class)<-[:DEFINES]-(m:Sym)
WHERE m.kind = 'method'
RETURN c.name, c.file, count(m) AS method_count
ORDER BY method_count DESC LIMIT 20;

-- Class inheritance hierarchy
MATCH (child:Sym:Class)-[:INHERITS]->(parent:Sym:Class)
RETURN child.name AS child, parent.name AS parent, child.file
ORDER BY parent;

-- Classes implementing interfaces
MATCH (c:Sym:Class)-[:IMPLEMENTS]->(i:Sym:Interface)
RETURN c.name AS class, i.name AS interface
ORDER BY interface;
```

## Call Graph Analysis

```cypher
-- Most called functions/methods
MATCH (caller:Sym)-[:CALLS]->(callee:Sym)
RETURN callee.name, callee.kind, callee.file, count(caller) AS call_count
ORDER BY call_count DESC LIMIT 30;

-- Call chains (2 hops)
MATCH path = (a:Sym)-[:CALLS]->(b:Sym)-[:CALLS]->(c:Sym)
WHERE a <> c
RETURN a.name, b.name, c.name, a.file
LIMIT 50;

-- Recursive calls
MATCH (n:Sym)-[:CALLS]->(n)
RETURN n.name, n.kind, n.file;
```

## Visibility Analysis

```cypher
-- Public API surface
MATCH (n:Sym)
WHERE n.visibility = 'public' AND n.kind IN ['class', 'function', 'interface']
RETURN n.kind, n.name, n.file
ORDER BY n.kind, n.name;

-- Private methods never called internally
MATCH (m:Sym)
WHERE m.visibility = 'private' AND m.kind = 'method'
AND NOT ()-[:CALLS]->(m)
RETURN m.name, m.file
LIMIT 50;
```

## File-Level Analysis

```cypher
-- Symbols per file
MATCH (n:Sym)
RETURN n.file, count(n) AS symbols, collect(DISTINCT n.kind) AS kinds
ORDER BY symbols DESC LIMIT 30;

-- Files with circular dependencies
MATCH (a:Sym)-[:IMPORTS]->(b:Sym), (b)-[:IMPORTS]->(a)
WHERE a.file <> b.file
RETURN DISTINCT a.file, b.file;
```

## Pattern Detection Helpers

```cypher
-- Find potential facades (classes with high fan-out)
MATCH (c:Sym:Class)-[:CALLS]->(other:Sym)
WITH c, count(DISTINCT other) AS fan_out
WHERE fan_out > 10
RETURN c.name, c.file, fan_out
ORDER BY fan_out DESC;

-- Find potential god classes (many methods + high coupling)
MATCH (c:Sym:Class)<-[:DEFINES]-(m:Sym {kind: 'method'})
WITH c, count(m) AS methods
WHERE methods > 15
MATCH (c)-[:CALLS|USES]->(other:Sym)
RETURN c.name, c.file, methods, count(DISTINCT other) AS dependencies
ORDER BY methods DESC;

-- Orphan interfaces (never implemented)
MATCH (i:Sym:Interface)
WHERE NOT ()-[:IMPLEMENTS]->(i)
RETURN i.name, i.file;
```

## Data Quality Checks

```cypher
-- Missing parent references
MATCH (n:Sym)
WHERE n.parent IS NOT NULL
AND NOT EXISTS { MATCH (p:Sym {id: n.parent}) }
RETURN n.name, n.parent AS missing_parent
LIMIT 50;

-- Edges pointing to non-existent nodes
MATCH (a:Sym)-[r]->(b:Sym)
WHERE a.id IS NULL OR b.id IS NULL
RETURN type(r), a.id, b.id
LIMIT 50;

-- Duplicate node IDs (should be empty)
MATCH (n:Sym)
WITH n.id AS id, count(n) AS cnt
WHERE cnt > 1
RETURN id, cnt;
```
