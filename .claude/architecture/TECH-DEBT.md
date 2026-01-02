# Technical Debt Inventory

> **Project**: Semantic Lens
> **Generated**: 2026-01-01
> **Status**: GREENFIELD PROJECT

## Overview

This is a greenfield project with no existing code, therefore there is no accumulated technical debt. This document serves as a template for tracking technical debt as the project evolves.

---

## Pre-Implementation Considerations

The following items represent potential technical debt vectors based on the specification analysis. These should be monitored during implementation.

### High Priority Considerations

| ID | Category | Description | Impact | Recommendation |
|----|----------|-------------|--------|----------------|
| TD-001 | Architecture | Graph DB as hard dependency | Lock-in, deployment complexity | Ensure in-memory store is fully functional fallback |
| TD-002 | Performance | Full graph loading | Memory issues with large codebases | Implement lazy loading, pagination from start |
| TD-003 | Schema | IR v1 schema stability | Breaking changes during development | Version schema, plan migration strategy |

### Medium Priority Considerations

| ID | Category | Description | Impact | Recommendation |
|----|----------|-------------|--------|----------------|
| TD-004 | Testing | Pattern detection validation | Hard to verify correctness | Build comprehensive test graph fixtures |
| TD-005 | Dependencies | ELK library size | Bundle size for client-side use | Consider server-side layout, lazy load |
| TD-006 | Complexity | Pattern DSL compiler | Maintenance burden | Start with subset, evolve incrementally |

### Low Priority Considerations

| ID | Category | Description | Impact | Recommendation |
|----|----------|-------------|--------|----------------|
| TD-007 | Documentation | Pattern DSL documentation | User adoption | Document as patterns are added |
| TD-008 | Tooling | Dev environment setup | Onboarding friction | Create setup script, docker-compose |

---

## Debt Categories Reference

### Code Quality
- Code duplication
- Complex functions
- Missing abstractions
- Poor naming

### Testing
- Missing unit tests
- Missing integration tests
- Insufficient edge case coverage
- Flaky tests

### Documentation
- Missing API documentation
- Outdated README
- Missing inline comments
- No architecture docs

### Dependencies
- Outdated packages
- Unused dependencies
- Security vulnerabilities
- License issues

### Architecture
- Tight coupling
- Missing interfaces
- Circular dependencies
- Monolithic components

### Performance
- N+1 queries
- Missing caching
- Unoptimized algorithms
- Memory leaks

### Security
- Hardcoded secrets
- Missing input validation
- Outdated auth patterns
- Exposed internals

---

## Tracking Template

When adding new technical debt, use this template:

```markdown
### [TD-XXX] Short Description

**Category**: [Code Quality | Testing | Documentation | Dependencies | Architecture | Performance | Security]
**Severity**: [High | Medium | Low]
**Introduced**: YYYY-MM-DD
**Location**: `path/to/file.ts`

**Description**:
Detailed description of the technical debt.

**Impact**:
What problems does this cause?

**Remediation**:
How should this be fixed?

**Estimated Effort**: [Hours | Days | Weeks]

**Related**:
- Links to issues, PRs, or other debt items
```

---

## Resolution Log

Track resolved technical debt here:

| ID | Description | Resolution Date | PR/Commit |
|----|-------------|-----------------|-----------|
| - | No debt resolved yet (greenfield) | - | - |

---

*This document should be updated as the project evolves. Review quarterly at minimum.*
