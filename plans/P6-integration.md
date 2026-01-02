# P6: Integration

> **Control Plane Reminder**: This phase plan is designed for execution via the **ai-dev-kit** plugin in Claude Code.
>
> - **Execute lanes**: `/ai-dev-kit:execute-lane plans/P6-integration.md SL-X`
> - **Execute phase**: `/ai-dev-kit:execute-phase plans/P6-integration.md main .worktrees 2`
>
> For tasks better suited to other agents:
> - **E2E browser automation**: `/ai-dev-kit:delegate codex "Write Playwright E2E test for graph visualization"`

---

## Summary

Phase 6 delivers the final integration layer for Semantic Lens:

1. **CLI tooling** for batch operations (validate, load, patterns, serve, export)
2. **E2E test suite** covering the full flow from bundle ingestion to visualization
3. **View caching** for performance optimization
4. **Documentation** including README, API docs, and usage examples

This phase ties together all previous work (Phases 1-5) into a production-ready tool.

---

## Interface Freeze Gates

### Core Interfaces (IF-0)
- [x] IF-0-P6-CLI: CLI command interface (validate, load, patterns, serve, export)
- [x] IF-0-P6-CACHE: View cache interface for computed views

### Cross-Phase Dependencies (Already Frozen)
- [x] IF-0-P1-SCHEMA: SemanticGraphBundle schema
- [x] IF-0-P2-STORE: GraphStore interface
- [x] IF-0-P3-MATCHER: PatternMatcher interface
- [x] IF-0-P4-VIEW: ViewService API endpoints
- [x] IF-0-P5-UI: Cytoscape integration (browser-based, not in scope for E2E)

---

## Lane Index & Dependencies

- SL-E2E -- E2E Testing & Performance
  - Depends on: IF-0-P6-CLI
  - Blocks: none
  - Parallel-safe: yes

- SL-CLI -- CLI & Documentation
  - Depends on: IF-0-P1-SCHEMA, IF-0-P2-STORE, IF-0-P3-MATCHER, IF-0-P4-VIEW
  - Blocks: SL-E2E (CLI needed for E2E tests)
  - Parallel-safe: no (creates core CLI structure)

---

## A. Architectural Baseline & Component Catalog

### Files to Add

| Path | Purpose |
|------|---------|
| `src/cli/index.ts` | CLI entry point and command router |
| `src/cli/commands/validate.ts` | Bundle validation command |
| `src/cli/commands/load.ts` | Bundle loading command |
| `src/cli/commands/patterns.ts` | Pattern detection command |
| `src/cli/commands/serve.ts` | Server start command |
| `src/cli/commands/export.ts` | View export command |
| `src/view-service/cache/view-cache.ts` | LRU view cache implementation |
| `tests/e2e/full-flow.test.ts` | E2E tests for complete flow |
| `tests/e2e/cli.test.ts` | CLI integration tests |
| `tests/e2e/fixtures/sample-codebase.json` | Real-world test bundle |
| `docs/README.md` | User documentation |
| `docs/api.md` | API endpoint documentation |

### Files to Modify

| Path | Change |
|------|--------|
| `package.json` | Add CLI bin entry, Playwright dev dependency |
| `src/view-service/api/server.ts` | Integrate view cache |

---

## B. Code-Level Interface Contracts

### CLI Interface

```typescript
// src/cli/index.ts
interface CLICommand {
  name: string;
  description: string;
  options: CLIOption[];
  action: (args: Record<string, unknown>) => Promise<number>;
}

interface CLIOption {
  flag: string;
  description: string;
  required?: boolean;
  default?: unknown;
}

// Commands:
// semantic-lens validate <bundle.json>
// semantic-lens load <bundle.json> [--db <uri>] [--clear]
// semantic-lens patterns [--output <file>] [--pattern <id>]
// semantic-lens serve [--port <port>]
// semantic-lens export <view-config.json> [--format png|svg|json]
```

### View Cache Interface

```typescript
// src/view-service/cache/view-cache.ts
interface ViewCache {
  get(key: string): ViewResponse | undefined;
  set(key: string, value: ViewResponse, ttlMs?: number): void;
  invalidate(key: string): void;
  clear(): void;
  stats(): CacheStats;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
}

function createViewCache(options?: { maxSize?: number; ttlMs?: number }): ViewCache;
```

---

## C. Exhaustive Change List

### Added Files

| File | Owner | Rationale |
|------|-------|-----------|
| `src/cli/index.ts` | SL-CLI | CLI entry point |
| `src/cli/commands/validate.ts` | SL-CLI | Validation command |
| `src/cli/commands/load.ts` | SL-CLI | Load bundle command |
| `src/cli/commands/patterns.ts` | SL-CLI | Pattern detection command |
| `src/cli/commands/serve.ts` | SL-CLI | Server start command |
| `src/cli/commands/export.ts` | SL-CLI | View export command |
| `src/view-service/cache/view-cache.ts` | SL-CLI | View caching for performance |
| `tests/e2e/full-flow.test.ts` | SL-E2E | E2E test suite |
| `tests/e2e/cli.test.ts` | SL-E2E | CLI integration tests |
| `tests/e2e/fixtures/sample-codebase.json` | SL-E2E | Test fixture |
| `docs/README.md` | SL-CLI | User documentation |
| `docs/api.md` | SL-CLI | API documentation |

### Modified Files

| File | Owner | Rationale |
|------|-------|-----------|
| `package.json` | SL-CLI | Add bin entry and dependencies |
| `src/view-service/api/server.ts` | SL-CLI | Add cache integration |

---

## D. Swim Lanes

### SL-CLI -- CLI & Documentation

**Scope**
- Implement command-line interface for all operations
- Create view caching layer for performance
- Write user documentation and API docs

**Owned Files**
- `src/cli/**/*.ts`
- `src/view-service/cache/**/*.ts`
- `docs/*.md`
- `package.json` (bin and scripts sections)

**Interfaces Provided**
- CLI command interface (validate, load, patterns, serve, export)
- ViewCache interface for computed view caching

**Interfaces Consumed**
- `GraphStore` from `src/graph/store.ts`
- `PatternMatcher` from `src/patterns/matcher/matcher.ts`
- `ViewServer` from `src/view-service/api/server.ts`
- `validateBundle` from `src/schema/validator.ts`
- `loadBundleToStore` from `src/graph/loader.ts`

**Tasks**

| Task ID | Task Type | Depends On | Files in Scope | Tests Owned Files | Test Command(s) | Acceptance Criteria |
|---------|-----------|------------|----------------|-------------------|-----------------|---------------------|
| P6-SL-CLI-01 | test | IF-0-P6-CLI | - | `tests/unit/cli/index.test.ts` | `npm run test -- tests/unit/cli` | Test stubs exist for all commands |
| P6-SL-CLI-02 | impl | P6-SL-CLI-01 | `src/cli/index.ts`, `src/cli/commands/*.ts` | `tests/unit/cli/*.test.ts` | `npm run test -- tests/unit/cli` | CLI parses args and routes commands |
| P6-SL-CLI-03 | test | P6-SL-CLI-02 | - | `tests/unit/view-service/cache.test.ts` | `npm run test -- tests/unit/view-service/cache` | Cache tests exist |
| P6-SL-CLI-04 | impl | P6-SL-CLI-03 | `src/view-service/cache/view-cache.ts` | `tests/unit/view-service/cache.test.ts` | `npm run test -- tests/unit/view-service/cache` | LRU cache with TTL works |
| P6-SL-CLI-05 | impl | P6-SL-CLI-04 | `src/view-service/api/server.ts` | `tests/unit/view-service/server.test.ts` | `npm run test -- tests/unit/view-service/server` | Server uses cache |
| P6-SL-CLI-06 | impl | P6-SL-CLI-02 | `package.json` | - | `npm run build && npx semantic-lens --help` | CLI runs as binary |
| P6-SL-CLI-07 | impl | P6-SL-CLI-06 | `docs/README.md`, `docs/api.md` | - | Manual review | Documentation is complete |
| P6-SL-CLI-08 | verify | P6-SL-CLI-07 | - | - | `npm run test -- tests/unit/cli tests/unit/view-service` | All CLI tests pass |

---

### SL-E2E -- E2E Testing & Performance

**Scope**
- Create end-to-end test suite with realistic fixtures
- Test full flow: validate -> load -> patterns -> view
- Performance profiling and optimization verification

**Owned Files**
- `tests/e2e/**/*.ts`
- `tests/e2e/fixtures/**/*.json`

**Interfaces Provided**
- None (testing lane)

**Interfaces Consumed**
- CLI commands (via process execution)
- REST API endpoints (via HTTP)
- All previous phase interfaces

**Tasks**

| Task ID | Task Type | Depends On | Files in Scope | Tests Owned Files | Test Command(s) | Acceptance Criteria |
|---------|-----------|------------|----------------|-------------------|-----------------|---------------------|
| P6-SL-E2E-01 | test | P6-SL-CLI-06 | - | `tests/e2e/fixtures/sample-codebase.json` | - | Realistic test fixture exists |
| P6-SL-E2E-02 | test | P6-SL-E2E-01 | - | `tests/e2e/cli.test.ts` | `npm run test:e2e` | CLI E2E tests defined |
| P6-SL-E2E-03 | test | P6-SL-E2E-02 | - | `tests/e2e/full-flow.test.ts` | `npm run test:e2e` | Full flow E2E tests defined |
| P6-SL-E2E-04 | verify | P6-SL-E2E-03 | - | - | `npm run test:e2e` | All E2E tests pass |
| P6-SL-E2E-05 | verify | P6-SL-E2E-04 | - | - | `npm run test -- --coverage` | Coverage meets targets |

---

## E. Execution Notes

### Parallelism Constraints

1. **SL-CLI must complete before SL-E2E** can begin, as E2E tests depend on the CLI being functional
2. Within SL-CLI, tasks are sequential (each builds on previous)
3. Within SL-E2E, tasks are sequential (test fixtures before tests, tests before verification)

### Recommended Execution Order

```
SL-CLI (sequential):
  P6-SL-CLI-01 -> P6-SL-CLI-02 -> P6-SL-CLI-03 -> P6-SL-CLI-04
  -> P6-SL-CLI-05 -> P6-SL-CLI-06 -> P6-SL-CLI-07 -> P6-SL-CLI-08

Then SL-E2E (sequential):
  P6-SL-E2E-01 -> P6-SL-E2E-02 -> P6-SL-E2E-03 -> P6-SL-E2E-04 -> P6-SL-E2E-05
```

### Critical Path

The critical path is through CLI implementation:
1. CLI implementation (unblocks E2E testing)
2. Cache implementation (unblocks performance verification)
3. E2E tests (validates full integration)

---

## F. File-by-File Specification

### `src/cli/index.ts` -- added -- Owner: SL-CLI

**Purpose**: CLI entry point that parses arguments and routes to commands

**Key Responsibilities**:
- Parse command-line arguments using minimal arg parsing
- Route to appropriate command handler
- Handle errors gracefully with exit codes
- Provide help text and version info

**Interfaces Exposed**:
- `main()`: Entry point function
- `parseArgs(argv: string[])`: Argument parser

**Tests Required**:
- Argument parsing for all commands
- Help output format
- Error handling for invalid commands

---

### `src/cli/commands/validate.ts` -- added -- Owner: SL-CLI

**Purpose**: Validate a SemanticGraphBundle JSON file

**Key Responsibilities**:
- Read JSON file from path
- Run AJV validation
- Output validation result with errors if any
- Exit with appropriate code (0 = valid, 1 = invalid)

**Interfaces Exposed**:
- `validateCommand(filePath: string): Promise<number>`

**Tests Required**:
- Valid bundle returns 0
- Invalid bundle returns 1 with error messages
- File not found handling

---

### `src/cli/commands/load.ts` -- added -- Owner: SL-CLI

**Purpose**: Load a bundle into a graph store

**Key Responsibilities**:
- Read and validate bundle
- Connect to store (in-memory or Memgraph)
- Load bundle with progress output
- Report statistics

**Interfaces Exposed**:
- `loadCommand(filePath: string, options: LoadCommandOptions): Promise<number>`

**Tests Required**:
- Successful load to memory store
- Progress callback output
- Error handling for invalid bundles

---

### `src/cli/commands/patterns.ts` -- added -- Owner: SL-CLI

**Purpose**: Run pattern detection on loaded graph

**Key Responsibilities**:
- Load pattern definitions from YAML files
- Run pattern matching
- Output results as JSON or formatted text
- Optionally filter by pattern ID

**Interfaces Exposed**:
- `patternsCommand(options: PatternsCommandOptions): Promise<number>`

**Tests Required**:
- Pattern detection with results
- Output format options
- Pattern filter works

---

### `src/cli/commands/serve.ts` -- added -- Owner: SL-CLI

**Purpose**: Start the view service HTTP server

**Key Responsibilities**:
- Initialize store and matcher
- Optionally pre-load a bundle
- Start Express server on specified port
- Handle shutdown gracefully

**Interfaces Exposed**:
- `serveCommand(options: ServeCommandOptions): Promise<number>`

**Tests Required**:
- Server starts on specified port
- Health endpoint responds
- Graceful shutdown

---

### `src/cli/commands/export.ts` -- added -- Owner: SL-CLI

**Purpose**: Export a view to static format

**Key Responsibilities**:
- Load view configuration from JSON
- Generate view via ViewService
- Export as JSON, PNG, or SVG
- Support headless rendering for images

**Interfaces Exposed**:
- `exportCommand(configPath: string, options: ExportCommandOptions): Promise<number>`

**Tests Required**:
- JSON export works
- View config validation
- Output file creation

---

### `src/view-service/cache/view-cache.ts` -- added -- Owner: SL-CLI

**Purpose**: LRU cache for computed views

**Key Responsibilities**:
- Store computed ViewResponse objects
- Implement LRU eviction policy
- Support TTL-based expiration
- Provide cache statistics

**Interfaces Exposed**:
- `ViewCache` interface
- `createViewCache(options?)`: Factory function

**Tests Required**:
- Get/set operations
- LRU eviction at max size
- TTL expiration
- Cache statistics accuracy

---

### `tests/e2e/full-flow.test.ts` -- added -- Owner: SL-E2E

**Purpose**: End-to-end tests for complete user flows

**Key Responsibilities**:
- Test: validate bundle -> load -> detect patterns -> generate view
- Test: API endpoints with real data
- Test: performance meets <200ms target for typical views
- Test: pattern overlays appear in views

**Interfaces Exposed**: None (test file)

**Tests Required**:
- Full flow integration test
- API response format validation
- Performance assertions

---

### `tests/e2e/cli.test.ts` -- added -- Owner: SL-E2E

**Purpose**: CLI integration tests

**Key Responsibilities**:
- Test all CLI commands with real files
- Test error cases and exit codes
- Test help output

**Interfaces Exposed**: None (test file)

**Tests Required**:
- Each command's success path
- Each command's error handling
- Help and version output

---

### `tests/e2e/fixtures/sample-codebase.json` -- added -- Owner: SL-E2E

**Purpose**: Realistic test bundle for E2E testing

**Key Responsibilities**:
- Represent a small but realistic codebase graph
- Include all node and edge kinds
- Include detectable patterns (Observer, Factory)
- Be large enough to test performance (~100 nodes)

**Interfaces Exposed**: None (data file)

**Tests Required**: N/A (fixture file)

---

### `docs/README.md` -- added -- Owner: SL-CLI

**Purpose**: User-facing documentation

**Key Responsibilities**:
- Getting started guide
- Installation instructions
- CLI usage examples
- API overview
- Example workflows

**Interfaces Exposed**: None (documentation)

**Tests Required**: None (manual review)

---

### `docs/api.md` -- added -- Owner: SL-CLI

**Purpose**: API endpoint documentation

**Key Responsibilities**:
- Document all REST endpoints
- Request/response schemas
- Error codes and handling
- Example requests with curl

**Interfaces Exposed**: None (documentation)

**Tests Required**: None (manual review)

---

### `package.json` -- modified -- Owner: SL-CLI

**Purpose**: Add CLI binary and E2E test dependencies

**Changes**:
- Add `"bin": { "semantic-lens": "./dist/cli/index.js" }`
- Add `"test:e2e": "vitest --config vitest.e2e.config.ts"` script
- Add `commander` or keep minimal arg parsing

**Tests Required**:
- CLI binary installs and runs

---

### `src/view-service/api/server.ts` -- modified -- Owner: SL-CLI

**Purpose**: Integrate view cache for performance

**Changes**:
- Import and use ViewCache
- Cache computed views by config hash
- Add cache stats to health endpoint

**Tests Required**:
- Cache hit returns cached view
- Cache miss computes and stores
- Cache stats in health response

---

## H. Test Execution Plan

### Unit Tests (SL-CLI)

```bash
# Run all CLI unit tests
npm run test -- tests/unit/cli

# Run cache unit tests
npm run test -- tests/unit/view-service/cache
```

### Integration Tests (SL-E2E)

```bash
# Run E2E tests
npm run test:e2e

# Or run all tests including E2E
npm run test
```

### Full Test Suite

```bash
# Run everything with coverage
npm run test -- --coverage

# Expected: >80% coverage on new code
```

### Test Ordering

1. Unit tests for CLI commands (fast, no I/O)
2. Unit tests for cache (fast, no I/O)
3. E2E CLI tests (spawn process, file I/O)
4. E2E API tests (HTTP, may need running server)

---

## J. Acceptance Criteria

### Functional Criteria

- [ ] `semantic-lens validate fixtures/valid-bundle.json` returns exit code 0
- [ ] `semantic-lens validate fixtures/invalid-bundle.json` returns exit code 1 with errors
- [ ] `semantic-lens load fixtures/valid-bundle.json` loads bundle and prints statistics
- [ ] `semantic-lens patterns` detects and outputs pattern matches
- [ ] `semantic-lens serve --port 3001` starts server on port 3001
- [ ] `semantic-lens export config.json --format json` produces valid JSON output

### Performance Criteria

- [ ] View generation for 100-node graphs completes in <200ms
- [ ] Second request for same view config uses cache (verified in stats)
- [ ] Bundle loading for 1000-node graphs completes in <1000ms

### Quality Criteria

- [ ] All E2E tests pass
- [ ] Code coverage >= 80% for new code
- [ ] No ESLint errors
- [ ] Documentation reviewed and accurate

### Integration Criteria

- [ ] CLI works as installed npm binary
- [ ] API endpoints match documentation
- [ ] Pattern detection produces valid JSON matching schema

---

## Output Validation Checklist

- [x] Document has correct `# P6: Integration` heading
- [x] All required sections (A through J) present
- [x] Lane Index & Dependencies section is machine-parseable
- [x] All interface contracts have IF-* gates
- [x] Each lane has unique ID (SL-CLI, SL-E2E)
- [x] Each lane has explicit file ownership
- [x] No unresolved file overlaps
- [x] Dependencies form a DAG (no cycles)
- [x] Each task has Task ID, Task Type, Depends On
- [x] Task ordering: test -> impl -> verify
- [x] All acceptance criteria are testable

---

_Generated by `/ai-dev-kit:plan-phase specs/ROADMAP.md "Phase 6"`_
