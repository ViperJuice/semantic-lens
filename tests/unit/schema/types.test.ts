import { describe, it, expect } from 'vitest';
import type {
  SemanticGraphBundle,
  Node,
  Edge,
  Annotation,
  PatternInstance,
  Repo,
  Span,
} from '../../../src/schema/types';
import type { NodeKind, EdgeKind, Visibility, Evidence } from '../../../src/constants';

/**
 * Type-level tests to ensure TypeScript types match the JSON Schema.
 * These tests verify compile-time type compatibility.
 */
describe('types', () => {
  describe('Span', () => {
    it('should be a tuple of two numbers', () => {
      const span: Span = [0, 100];
      expect(span).toHaveLength(2);
      expect(typeof span[0]).toBe('number');
      expect(typeof span[1]).toBe('number');
    });
  });

  describe('Repo', () => {
    it('should accept required and optional fields', () => {
      const repoMinimal: Repo = {
        url: 'https://github.com/example/repo',
        commit: 'abc1234',
      };
      expect(repoMinimal.url).toBeDefined();
      expect(repoMinimal.commit).toBeDefined();
      expect(repoMinimal.branch).toBeUndefined();

      const repoFull: Repo = {
        url: 'https://github.com/example/repo',
        commit: 'abc1234',
        branch: 'main',
      };
      expect(repoFull.branch).toBe('main');
    });
  });

  describe('Node', () => {
    it('should accept all required fields', () => {
      const node: Node = {
        node_id: 'test12345678',
        kind: 'function',
        name: 'testFunc',
        language: 'typescript',
        file: 'test.ts',
        span: [0, 100],
      };
      expect(node.node_id).toBeDefined();
      expect(node.kind).toBe('function');
    });

    it('should accept all optional fields', () => {
      const node: Node = {
        node_id: 'test12345678',
        kind: 'method',
        name: 'testMethod',
        language: 'typescript',
        file: 'test.ts',
        span: [0, 100],
        parent: 'parent123456',
        route: 'src/test.ts::TestClass::testMethod',
        visibility: 'public',
        signature: '(x: number) => number',
        doc_hash: 'sha256:abc123',
      };
      expect(node.parent).toBeDefined();
      expect(node.visibility).toBe('public');
    });

    it('should enforce NodeKind type for kind field', () => {
      // Type assertion to verify kind matches NodeKind
      const kinds: NodeKind[] = [
        'module',
        'class',
        'interface',
        'trait',
        'function',
        'method',
        'field',
        'property',
      ];
      for (const kind of kinds) {
        const node: Node = {
          node_id: 'test12345678',
          kind,
          name: 'test',
          language: 'ts',
          file: 'test.ts',
          span: [0, 1],
        };
        expect(node.kind).toBe(kind);
      }
    });

    it('should enforce Visibility type for visibility field', () => {
      const visibilities: Visibility[] = ['public', 'protected', 'private', 'unknown'];
      for (const visibility of visibilities) {
        const node: Node = {
          node_id: 'test12345678',
          kind: 'function',
          name: 'test',
          language: 'ts',
          file: 'test.ts',
          span: [0, 1],
          visibility,
        };
        expect(node.visibility).toBe(visibility);
      }
    });
  });

  describe('Edge', () => {
    it('should accept all required fields', () => {
      const edge: Edge = {
        edge_id: 'edge12345678',
        kind: 'calls',
        src: 'node1',
        dst: 'node2',
        confidence: 0.9,
        evidence: ['static_analysis'],
      };
      expect(edge.edge_id).toBeDefined();
      expect(edge.confidence).toBe(0.9);
    });

    it('should accept optional meta field', () => {
      const edge: Edge = {
        edge_id: 'edge12345678',
        kind: 'calls',
        src: 'node1',
        dst: 'node2',
        confidence: 0.9,
        evidence: ['static_analysis'],
        meta: {
          lineNumber: 42,
          isAsync: true,
        },
      };
      expect(edge.meta).toBeDefined();
      expect(edge.meta?.lineNumber).toBe(42);
    });

    it('should enforce EdgeKind type for kind field', () => {
      const kinds: EdgeKind[] = [
        'defines',
        'imports',
        'calls',
        'inherits',
        'implements',
        'uses',
        'reads',
        'writes',
        'throws',
      ];
      for (const kind of kinds) {
        const edge: Edge = {
          edge_id: 'edge12345678',
          kind,
          src: 'node1',
          dst: 'node2',
          confidence: 0.9,
          evidence: ['static_analysis'],
        };
        expect(edge.kind).toBe(kind);
      }
    });

    it('should enforce Evidence type for evidence array', () => {
      const evidenceTypes: Evidence[] = [
        'chunker',
        'lsp',
        'static_analysis',
        'heuristic',
        'llm_score',
      ];
      const edge: Edge = {
        edge_id: 'edge12345678',
        kind: 'calls',
        src: 'node1',
        dst: 'node2',
        confidence: 0.9,
        evidence: evidenceTypes,
      };
      expect(edge.evidence).toHaveLength(evidenceTypes.length);
    });
  });

  describe('Annotation', () => {
    it('should accept required fields', () => {
      const annotation: Annotation = {
        target_id: 'node12345678',
        tags: ['tag1', 'tag2'],
      };
      expect(annotation.target_id).toBeDefined();
      expect(annotation.tags).toHaveLength(2);
    });

    it('should accept optional kv field with various value types', () => {
      const annotation: Annotation = {
        target_id: 'node12345678',
        tags: ['tag1'],
        kv: {
          stringVal: 'hello',
          numberVal: 42,
          boolVal: true,
          nullVal: null,
        },
      };
      expect(annotation.kv?.stringVal).toBe('hello');
      expect(annotation.kv?.numberVal).toBe(42);
      expect(annotation.kv?.boolVal).toBe(true);
      expect(annotation.kv?.nullVal).toBeNull();
    });
  });

  describe('PatternInstance', () => {
    it('should accept all required fields', () => {
      const pattern: PatternInstance = {
        instance_id: 'pattern12345678',
        pattern_id: 'SINGLETON',
        roles: {
          class: 'node1',
          getInstance: 'node2',
        },
        confidence: 0.85,
        evidence: ['Single instance detected'],
      };
      expect(pattern.instance_id).toBeDefined();
      expect(pattern.roles.class).toBe('node1');
    });

    it('should accept optional explain field', () => {
      const pattern: PatternInstance = {
        instance_id: 'pattern12345678',
        pattern_id: 'FACTORY',
        roles: { factory: 'node1' },
        confidence: 0.9,
        evidence: ['Factory method present'],
        explain: 'This class uses the factory pattern to create instances',
      };
      expect(pattern.explain).toBeDefined();
    });
  });

  describe('SemanticGraphBundle', () => {
    it('should accept all required fields', () => {
      const bundle: SemanticGraphBundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        nodes: [],
        edges: [],
        annotations: [],
        patterns: [],
      };
      expect(bundle.version).toBe('v1.0');
      expect(bundle.nodes).toHaveLength(0);
    });

    it('should accept optional repo field', () => {
      const bundle: SemanticGraphBundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        repo: {
          url: 'https://github.com/example/repo',
          commit: 'abc1234',
        },
        nodes: [],
        edges: [],
        annotations: [],
        patterns: [],
      };
      expect(bundle.repo?.url).toBeDefined();
    });

    it('should accept complete bundle with all data', () => {
      const bundle: SemanticGraphBundle = {
        version: 'v1.0',
        generated_at: '2024-01-15T00:00:00Z',
        repo: {
          url: 'https://github.com/example/repo',
          commit: 'abc1234',
          branch: 'main',
        },
        nodes: [
          {
            node_id: 'node12345678',
            kind: 'function',
            name: 'test',
            language: 'typescript',
            file: 'test.ts',
            span: [0, 100],
          },
        ],
        edges: [
          {
            edge_id: 'edge12345678',
            kind: 'calls',
            src: 'node12345678',
            dst: 'node12345678',
            confidence: 0.9,
            evidence: ['static_analysis'],
          },
        ],
        annotations: [
          {
            target_id: 'node12345678',
            tags: ['test'],
          },
        ],
        patterns: [
          {
            instance_id: 'pattern1234',
            pattern_id: 'TEST',
            roles: {},
            confidence: 1.0,
            evidence: ['test'],
          },
        ],
      };
      expect(bundle.nodes).toHaveLength(1);
      expect(bundle.edges).toHaveLength(1);
      expect(bundle.annotations).toHaveLength(1);
      expect(bundle.patterns).toHaveLength(1);
    });
  });
});
