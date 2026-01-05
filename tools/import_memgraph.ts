#!/usr/bin/env npx ts-node
/**
 * Import SemanticGraphBundle (.slb/.json) into Memgraph
 *
 * Usage:
 *   npx ts-node tools/import_memgraph.ts fixtures/semantic-lens-v4.slb
 *   npx ts-node tools/import_memgraph.ts fixtures/realistic-bundle.json --clear
 *   npx ts-node tools/import_memgraph.ts fixtures/semantic-lens-v4.slb --host localhost --port 7688
 */

import neo4j, { Driver, Session } from 'neo4j-driver';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface BundleNode {
  node_id: string;
  kind: string;
  name: string;
  file: string;
  route?: string;
  span?: [number, number];
  visibility?: string;
  language?: string;
  parent?: string;
  signature?: string;
}

interface BundleEdge {
  edge_id: string;
  kind: string;
  src: string;
  dst: string;
  confidence?: number;
  evidence?: string[];
}

interface SemanticGraphBundle {
  version: string;
  nodes: BundleNode[];
  edges: BundleEdge[];
  annotations?: unknown[];
  patterns?: unknown[];
}

// Node kind to Cypher label mapping
const KIND_TO_LABEL: Record<string, string> = {
  module: 'Module',
  class: 'Class',
  interface: 'Interface',
  trait: 'Trait',
  function: 'Function',
  method: 'Method',
  field: 'Field',
  property: 'Property',
};

// Edge kind to relationship type mapping
const EDGE_KIND_TO_TYPE: Record<string, string> = {
  defines: 'DEFINES',
  imports: 'IMPORTS',
  calls: 'CALLS',
  inherits: 'INHERITS',
  implements: 'IMPLEMENTS',
  uses: 'USES',
  reads: 'READS',
  writes: 'WRITES',
  throws: 'THROWS',
};

function isSyntheticEdge(edge: BundleEdge): boolean {
  // Synthetic edges: confidence < 1.0 or evidence contains heuristic/llm_score
  if (edge.confidence !== undefined && edge.confidence < 1.0) {
    return true;
  }
  if (edge.evidence) {
    return edge.evidence.some((e) => e === 'heuristic' || e === 'llm_score');
  }
  return false;
}

async function clearDatabase(session: Session): Promise<void> {
  console.log('Clearing existing data...');
  await session.run('MATCH (n) DETACH DELETE n');
  console.log('Database cleared.');
}

async function createIndexes(session: Session): Promise<void> {
  console.log('Creating indexes...');
  try {
    await session.run('CREATE INDEX ON :Sym(id)');
  } catch {
    // Index may already exist
  }
  try {
    await session.run('CREATE INDEX ON :Sym(kind)');
  } catch {
    // Index may already exist
  }
  try {
    await session.run('CREATE INDEX ON :Sym(file)');
  } catch {
    // Index may already exist
  }
  console.log('Indexes created.');
}

async function importNodes(session: Session, nodes: BundleNode[]): Promise<void> {
  console.log(`Importing ${nodes.length} nodes...`);

  const batchSize = 100;
  for (let i = 0; i < nodes.length; i += batchSize) {
    const batch = nodes.slice(i, i + batchSize);

    // Use UNWIND for batch inserts
    await session.run(
      `
      UNWIND $nodes AS node
      CREATE (n:Sym {
        id: node.node_id,
        kind: node.kind,
        name: node.name,
        file: node.file,
        route: node.route,
        parent: node.parent,
        visibility: node.visibility,
        language: node.language,
        signature: node.signature,
        span_start: node.span_start,
        span_end: node.span_end
      })
      WITH n, node
      CALL {
        WITH n, node
        WITH n, node WHERE node.kind = 'module' SET n:Module
        RETURN 1 AS dummy
        UNION ALL
        WITH n, node WHERE node.kind = 'class' SET n:Class
        RETURN 1 AS dummy
        UNION ALL
        WITH n, node WHERE node.kind = 'interface' SET n:Interface
        RETURN 1 AS dummy
        UNION ALL
        WITH n, node WHERE node.kind = 'trait' SET n:Trait
        RETURN 1 AS dummy
        UNION ALL
        WITH n, node WHERE node.kind = 'function' SET n:Function
        RETURN 1 AS dummy
        UNION ALL
        WITH n, node WHERE node.kind = 'method' SET n:Method
        RETURN 1 AS dummy
        UNION ALL
        WITH n, node WHERE node.kind = 'field' SET n:Field
        RETURN 1 AS dummy
        UNION ALL
        WITH n, node WHERE node.kind = 'property' SET n:Property
        RETURN 1 AS dummy
      }
      RETURN count(n) AS created
      `,
      {
        nodes: batch.map((n) => ({
          node_id: n.node_id,
          kind: n.kind,
          name: n.name,
          file: n.file,
          route: n.route ?? null,
          parent: n.parent ?? null,
          visibility: n.visibility ?? null,
          language: n.language ?? null,
          signature: n.signature ?? null,
          span_start: n.span?.[0] ?? null,
          span_end: n.span?.[1] ?? null,
        })),
      }
    );

    console.log(`  Imported ${Math.min(i + batchSize, nodes.length)}/${nodes.length} nodes`);
  }
}

async function importEdges(session: Session, edges: BundleEdge[]): Promise<void> {
  console.log(`Importing ${edges.length} edges...`);

  // Group edges by kind for batch processing
  const edgesByKind = new Map<string, BundleEdge[]>();
  for (const edge of edges) {
    const relType = EDGE_KIND_TO_TYPE[edge.kind] ?? edge.kind.toUpperCase();
    if (!edgesByKind.has(relType)) {
      edgesByKind.set(relType, []);
    }
    edgesByKind.get(relType)!.push(edge);
  }

  let totalImported = 0;
  for (const [relType, typeEdges] of edgesByKind) {
    const batchSize = 100;
    for (let i = 0; i < typeEdges.length; i += batchSize) {
      const batch = typeEdges.slice(i, i + batchSize);

      // Dynamic relationship type requires APOC or multiple queries
      // For simplicity, we'll create relationships with a single type at a time
      await session.run(
        `
        UNWIND $edges AS edge
        MATCH (src:Sym {id: edge.src})
        MATCH (dst:Sym {id: edge.dst})
        CREATE (src)-[r:${relType} {
          id: edge.edge_id,
          confidence: edge.confidence,
          evidence: edge.evidence,
          synthetic: edge.synthetic
        }]->(dst)
        `,
        {
          edges: batch.map((e) => ({
            edge_id: e.edge_id,
            src: e.src,
            dst: e.dst,
            confidence: e.confidence ?? 1.0,
            evidence: e.evidence ?? [],
            synthetic: isSyntheticEdge(e),
          })),
        }
      );

      totalImported += batch.length;
      console.log(`  Imported ${totalImported}/${edges.length} edges (${relType})`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx ts-node tools/import_memgraph.ts <bundle-file> [options]

Options:
  --clear         Clear database before import
  --host <host>   Memgraph host (default: localhost)
  --port <port>   Memgraph Bolt port (default: 7687)
  --user <user>   Memgraph user (default: memgraph)
  --pass <pass>   Memgraph password (default: memgraph)
  --help, -h      Show this help message

Examples:
  npx ts-node tools/import_memgraph.ts fixtures/semantic-lens-v4.slb
  npx ts-node tools/import_memgraph.ts fixtures/realistic-bundle.json --clear
  MEMGRAPH_BOLT_PORT=7688 npx ts-node tools/import_memgraph.ts fixtures/bundle.slb
`);
    process.exit(0);
  }

  // Parse arguments
  const bundlePath = args[0]!;
  const clearDb = args.includes('--clear');

  const hostIdx = args.indexOf('--host');
  const host = hostIdx !== -1 ? args[hostIdx + 1] ?? 'localhost' : 'localhost';

  const portIdx = args.indexOf('--port');
  const port =
    portIdx !== -1
      ? args[portIdx + 1] ?? process.env.MEMGRAPH_BOLT_PORT ?? '7687'
      : process.env.MEMGRAPH_BOLT_PORT ?? '7687';

  const userIdx = args.indexOf('--user');
  const user = userIdx !== -1 ? args[userIdx + 1] ?? 'memgraph' : 'memgraph';

  const passIdx = args.indexOf('--pass');
  const password = passIdx !== -1 ? args[passIdx + 1] ?? 'memgraph' : 'memgraph';

  // Load bundle
  const fullPath = resolve(process.cwd(), bundlePath);
  console.log(`Loading bundle: ${bundlePath}`);

  let bundle: SemanticGraphBundle;
  try {
    const content = readFileSync(fullPath, 'utf-8');
    bundle = JSON.parse(content) as SemanticGraphBundle;
  } catch (err) {
    console.error(`Failed to load bundle: ${err}`);
    process.exit(1);
  }

  console.log(`Bundle version: ${bundle.version}`);
  console.log(`  Nodes: ${bundle.nodes.length}`);
  console.log(`  Edges: ${bundle.edges.length}`);

  // Connect to Memgraph
  const uri = `bolt://${host}:${port}`;
  console.log(`\nConnecting to Memgraph at ${uri}...`);

  let driver: Driver | null = null;
  let session: Session | null = null;

  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    await driver.verifyConnectivity();
    console.log('Connected to Memgraph.');

    session = driver.session();

    if (clearDb) {
      await clearDatabase(session);
    }

    await createIndexes(session);
    await importNodes(session, bundle.nodes);
    await importEdges(session, bundle.edges);

    console.log('\nImport complete!');
    console.log(`\nOpen Memgraph Lab at http://localhost:${process.env.MEMGRAPH_LAB_PORT ?? '3003'}`);
    console.log('Use Quick Connect with default credentials.');
  } catch (err) {
    console.error(`Import failed: ${err}`);
    process.exit(1);
  } finally {
    if (session) await session.close();
    if (driver) await driver.close();
  }
}

main().catch(console.error);
