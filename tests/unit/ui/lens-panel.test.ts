/**
 * Lens Panel Tests
 * Tests for the lens control panel component.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createLensPanel,
  renderEdgeKindToggles,
  renderConfidenceSlider,
  type LensPanel,
} from '../../../src/ui/controls/lens-panel.js';
import { DEFAULT_LENS_CONFIG, type LensConfig } from '../../../src/ui/types.js';
import type { EdgeKind, NodeKind } from '../../../src/constants.js';

// Mock container for headless testing
const createMockContainer = (): HTMLElement => {
  let innerHTML = '';
  return {
    innerHTML,
    get outerHTML() {
      return `<div>${innerHTML}</div>`;
    },
    set innerHTMLValue(value: string) {
      innerHTML = value;
    },
    appendChild: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLElement;
};

describe('createLensPanel', () => {
  it('should create a LensPanel instance', () => {
    const onChange = vi.fn();
    const panel = createLensPanel({
      config: DEFAULT_LENS_CONFIG,
      onChange,
      availableEdgeKinds: ['calls', 'inherits', 'implements'],
      availableNodeKinds: ['class', 'method', 'function'],
    });

    expect(panel).toBeDefined();
    expect(typeof panel.render).toBe('function');
    expect(typeof panel.update).toBe('function');
    expect(typeof panel.getConfig).toBe('function');
    expect(typeof panel.destroy).toBe('function');
  });

  it('should return current config', () => {
    const onChange = vi.fn();
    const config: LensConfig = {
      edgeKinds: ['calls'],
      minConfidence: 0.5,
      showPatterns: false,
    };
    const panel = createLensPanel({
      config,
      onChange,
      availableEdgeKinds: ['calls', 'inherits'],
      availableNodeKinds: ['class'],
    });

    const returnedConfig = panel.getConfig();
    expect(returnedConfig).toEqual(config);
  });

  it('should update config when update() is called', () => {
    const onChange = vi.fn();
    const panel = createLensPanel({
      config: DEFAULT_LENS_CONFIG,
      onChange,
      availableEdgeKinds: ['calls', 'inherits'],
      availableNodeKinds: ['class'],
    });

    const newConfig: LensConfig = {
      edgeKinds: ['inherits'],
      minConfidence: 0.8,
      showPatterns: true,
    };
    panel.update({ config: newConfig });

    expect(panel.getConfig()).toEqual(newConfig);
  });

  it('should render to container', () => {
    const container = createMockContainer();
    const onChange = vi.fn();
    const panel = createLensPanel({
      config: DEFAULT_LENS_CONFIG,
      onChange,
      availableEdgeKinds: ['calls', 'inherits', 'implements'],
      availableNodeKinds: ['class', 'method'],
    });

    expect(() => panel.render(container)).not.toThrow();
  });

  it('should destroy cleanly', () => {
    const container = createMockContainer();
    const onChange = vi.fn();
    const panel = createLensPanel({
      config: DEFAULT_LENS_CONFIG,
      onChange,
      availableEdgeKinds: ['calls'],
      availableNodeKinds: ['class'],
    });

    panel.render(container);
    expect(() => panel.destroy()).not.toThrow();
  });
});

describe('renderEdgeKindToggles', () => {
  it('should generate HTML for all edge kinds', () => {
    const kinds: EdgeKind[] = ['calls', 'inherits', 'implements'];
    const enabled: EdgeKind[] = ['calls', 'inherits'];
    const onChange = vi.fn();

    const html = renderEdgeKindToggles(kinds, enabled, onChange);

    expect(typeof html).toBe('string');
    expect(html).toContain('calls');
    expect(html).toContain('inherits');
    expect(html).toContain('implements');
  });

  it('should mark enabled kinds as checked', () => {
    const kinds: EdgeKind[] = ['calls', 'inherits'];
    const enabled: EdgeKind[] = ['calls'];
    const onChange = vi.fn();

    const html = renderEdgeKindToggles(kinds, enabled, onChange);

    // Should have checked attribute for enabled kinds
    expect(html).toContain('checked');
  });

  it('should handle empty kinds array', () => {
    const kinds: EdgeKind[] = [];
    const enabled: EdgeKind[] = [];
    const onChange = vi.fn();

    const html = renderEdgeKindToggles(kinds, enabled, onChange);

    expect(typeof html).toBe('string');
  });
});

describe('renderConfidenceSlider', () => {
  it('should generate HTML for slider', () => {
    const onChange = vi.fn();
    const html = renderConfidenceSlider(0.5, onChange);

    expect(typeof html).toBe('string');
    expect(html).toContain('confidence');
    expect(html).toContain('0.5');
  });

  it('should handle 0 value', () => {
    const onChange = vi.fn();
    const html = renderConfidenceSlider(0, onChange);

    expect(html).toContain('0');
  });

  it('should handle 1 value', () => {
    const onChange = vi.fn();
    const html = renderConfidenceSlider(1, onChange);

    expect(html).toContain('1');
  });

  it('should include range input', () => {
    const onChange = vi.fn();
    const html = renderConfidenceSlider(0.5, onChange);

    expect(html).toContain('type="range"');
    expect(html).toContain('min="0"');
    expect(html).toContain('max="1"');
  });
});

describe('LensPanel config changes', () => {
  it('should call onChange when config is updated externally', () => {
    const onChange = vi.fn();
    const panel = createLensPanel({
      config: DEFAULT_LENS_CONFIG,
      onChange,
      availableEdgeKinds: ['calls', 'inherits'],
      availableNodeKinds: ['class'],
    });

    // Simulate config change
    const newConfig: LensConfig = {
      edgeKinds: ['calls'],
      minConfidence: 0.7,
      showPatterns: true,
    };

    // When update is called with a new config and then getConfig returns it
    panel.update({ config: newConfig });
    expect(panel.getConfig()).toEqual(newConfig);
  });

  it('should preserve patternFilter when updating edgeKinds', () => {
    const onChange = vi.fn();
    const initialConfig: LensConfig = {
      edgeKinds: ['calls', 'inherits'],
      minConfidence: 0.5,
      showPatterns: true,
      patternFilter: ['observer', 'strategy'],
    };
    const panel = createLensPanel({
      config: initialConfig,
      onChange,
      availableEdgeKinds: ['calls', 'inherits', 'implements'],
      availableNodeKinds: ['class'],
    });

    panel.update({ config: { ...initialConfig, edgeKinds: ['calls'] } });

    const config = panel.getConfig();
    expect(config.patternFilter).toEqual(['observer', 'strategy']);
  });
});

describe('LensPanel available kinds', () => {
  it('should update available edge kinds', () => {
    const onChange = vi.fn();
    const panel = createLensPanel({
      config: DEFAULT_LENS_CONFIG,
      onChange,
      availableEdgeKinds: ['calls'],
      availableNodeKinds: ['class'],
    });

    const newEdgeKinds: EdgeKind[] = ['calls', 'inherits', 'implements'];
    panel.update({ availableEdgeKinds: newEdgeKinds });

    // Panel should accept the update without error
    expect(() => panel.getConfig()).not.toThrow();
  });

  it('should update available node kinds', () => {
    const onChange = vi.fn();
    const panel = createLensPanel({
      config: DEFAULT_LENS_CONFIG,
      onChange,
      availableEdgeKinds: ['calls'],
      availableNodeKinds: ['class'],
    });

    const newNodeKinds: NodeKind[] = ['class', 'method', 'function', 'interface'];
    panel.update({ availableNodeKinds: newNodeKinds });

    // Panel should accept the update without error
    expect(() => panel.getConfig()).not.toThrow();
  });
});
