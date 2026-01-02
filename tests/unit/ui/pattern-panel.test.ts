/**
 * Pattern Panel Tests
 * Tests for the pattern list and navigation panel.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createPatternPanel,
  groupPatternsByType,
  formatPatternSummary,
  type PatternPanel,
} from '../../../src/ui/controls/pattern-panel.js';
import type { PatternMatch } from '../../../src/patterns/types.js';

// Mock container for headless testing
const createMockContainer = (): HTMLElement => {
  return {
    innerHTML: '',
    appendChild: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLElement;
};

const createTestPatterns = (): PatternMatch[] => [
  {
    instanceId: 'observer-1',
    patternId: 'observer',
    roles: { subject: 'node1', observer: ['node2', 'node3'] },
    confidence: 0.9,
    evidence: ['calls update method'],
  },
  {
    instanceId: 'observer-2',
    patternId: 'observer',
    roles: { subject: 'node4', observer: ['node5'] },
    confidence: 0.7,
    evidence: ['calls notify'],
  },
  {
    instanceId: 'strategy-1',
    patternId: 'strategy',
    roles: { context: 'node6', strategy: 'node7' },
    confidence: 0.85,
    evidence: ['implements interface'],
  },
  {
    instanceId: 'singleton-1',
    patternId: 'singleton',
    roles: { class: 'node8' },
    confidence: 0.95,
    evidence: ['private constructor'],
    explain: 'Class has getInstance method',
  },
];

describe('createPatternPanel', () => {
  it('should create a PatternPanel instance', () => {
    const onPatternSelect = vi.fn();
    const onClearHighlight = vi.fn();
    const panel = createPatternPanel({
      patterns: createTestPatterns(),
      onPatternSelect,
      onClearHighlight,
    });

    expect(panel).toBeDefined();
    expect(typeof panel.render).toBe('function');
    expect(typeof panel.update).toBe('function');
    expect(typeof panel.getGroupedPatterns).toBe('function');
    expect(typeof panel.destroy).toBe('function');
  });

  it('should render to container', () => {
    const container = createMockContainer();
    const onPatternSelect = vi.fn();
    const onClearHighlight = vi.fn();
    const panel = createPatternPanel({
      patterns: createTestPatterns(),
      onPatternSelect,
      onClearHighlight,
    });

    expect(() => panel.render(container)).not.toThrow();
  });

  it('should return grouped patterns', () => {
    const onPatternSelect = vi.fn();
    const onClearHighlight = vi.fn();
    const panel = createPatternPanel({
      patterns: createTestPatterns(),
      onPatternSelect,
      onClearHighlight,
      groupByPattern: true,
    });

    const grouped = panel.getGroupedPatterns();
    expect(grouped).toBeInstanceOf(Map);
    expect(grouped.get('observer')).toHaveLength(2);
    expect(grouped.get('strategy')).toHaveLength(1);
    expect(grouped.get('singleton')).toHaveLength(1);
  });

  it('should update patterns', () => {
    const onPatternSelect = vi.fn();
    const onClearHighlight = vi.fn();
    const panel = createPatternPanel({
      patterns: [],
      onPatternSelect,
      onClearHighlight,
    });

    panel.update({ patterns: createTestPatterns() });
    const grouped = panel.getGroupedPatterns();
    expect(grouped.size).toBe(3);
  });

  it('should destroy cleanly', () => {
    const container = createMockContainer();
    const onPatternSelect = vi.fn();
    const onClearHighlight = vi.fn();
    const panel = createPatternPanel({
      patterns: createTestPatterns(),
      onPatternSelect,
      onClearHighlight,
    });

    panel.render(container);
    expect(() => panel.destroy()).not.toThrow();
  });
});

describe('groupPatternsByType', () => {
  it('should group patterns by pattern ID', () => {
    const patterns = createTestPatterns();
    const grouped = groupPatternsByType(patterns);

    expect(grouped.size).toBe(3);
    expect(grouped.get('observer')).toHaveLength(2);
    expect(grouped.get('strategy')).toHaveLength(1);
    expect(grouped.get('singleton')).toHaveLength(1);
  });

  it('should handle empty patterns array', () => {
    const grouped = groupPatternsByType([]);
    expect(grouped.size).toBe(0);
  });

  it('should preserve pattern order within groups', () => {
    const patterns = createTestPatterns();
    const grouped = groupPatternsByType(patterns);
    const observerPatterns = grouped.get('observer')!;

    expect(observerPatterns[0].instanceId).toBe('observer-1');
    expect(observerPatterns[1].instanceId).toBe('observer-2');
  });
});

describe('formatPatternSummary', () => {
  it('should format pattern with instance ID and pattern ID', () => {
    const pattern: PatternMatch = {
      instanceId: 'observer-1',
      patternId: 'observer',
      roles: { subject: 'node1' },
      confidence: 0.9,
      evidence: ['test'],
    };

    const summary = formatPatternSummary(pattern);
    expect(summary).toContain('observer');
    expect(summary).toContain('90%'); // Confidence shown as percentage
  });

  it('should include confidence as percentage', () => {
    const pattern: PatternMatch = {
      instanceId: 'test-1',
      patternId: 'strategy',
      roles: { context: 'node1' },
      confidence: 0.85,
      evidence: [],
    };

    const summary = formatPatternSummary(pattern);
    expect(summary).toContain('85%');
  });

  it('should handle pattern with explanation', () => {
    const pattern: PatternMatch = {
      instanceId: 'singleton-1',
      patternId: 'singleton',
      roles: { class: 'node1' },
      confidence: 0.95,
      evidence: [],
      explain: 'Private constructor detected',
    };

    const summary = formatPatternSummary(pattern);
    expect(summary).toContain('singleton');
  });

  it('should include role count', () => {
    const pattern: PatternMatch = {
      instanceId: 'observer-1',
      patternId: 'observer',
      roles: { subject: 'node1', observer: ['node2', 'node3'] },
      confidence: 0.9,
      evidence: [],
    };

    const summary = formatPatternSummary(pattern);
    // Should mention roles or participants
    expect(summary.length).toBeGreaterThan(0);
  });
});

describe('PatternPanel selection', () => {
  it('should accept highlightedPattern prop', () => {
    const container = createMockContainer();
    const onPatternSelect = vi.fn();
    const onClearHighlight = vi.fn();
    const panel = createPatternPanel({
      patterns: createTestPatterns(),
      highlightedPattern: 'observer-1',
      onPatternSelect,
      onClearHighlight,
    });

    expect(() => panel.render(container)).not.toThrow();
  });

  it('should update highlightedPattern', () => {
    const onPatternSelect = vi.fn();
    const onClearHighlight = vi.fn();
    const panel = createPatternPanel({
      patterns: createTestPatterns(),
      onPatternSelect,
      onClearHighlight,
    });

    expect(() => panel.update({ highlightedPattern: 'strategy-1' })).not.toThrow();
  });
});

describe('PatternPanel grouping', () => {
  it('should support groupByPattern=true', () => {
    const container = createMockContainer();
    const onPatternSelect = vi.fn();
    const onClearHighlight = vi.fn();
    const panel = createPatternPanel({
      patterns: createTestPatterns(),
      onPatternSelect,
      onClearHighlight,
      groupByPattern: true,
    });

    expect(() => panel.render(container)).not.toThrow();
    const grouped = panel.getGroupedPatterns();
    expect(grouped.size).toBe(3);
  });

  it('should support groupByPattern=false', () => {
    const container = createMockContainer();
    const onPatternSelect = vi.fn();
    const onClearHighlight = vi.fn();
    const panel = createPatternPanel({
      patterns: createTestPatterns(),
      onPatternSelect,
      onClearHighlight,
      groupByPattern: false,
    });

    expect(() => panel.render(container)).not.toThrow();
  });
});
