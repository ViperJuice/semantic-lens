/**
 * Pattern Panel
 * Panel for listing and navigating pattern matches.
 */

import type { PatternMatch } from '../../patterns/types.js';
import type { PatternPanelProps } from '../types.js';

/**
 * Pattern panel controller interface.
 */
export interface PatternPanel {
  /** Render the panel to a container */
  render(container: HTMLElement): void;
  /** Update the panel state */
  update(props: Partial<PatternPanelProps>): void;
  /** Get grouped patterns by pattern ID */
  getGroupedPatterns(): Map<string, PatternMatch[]>;
  /** Destroy the panel */
  destroy(): void;
}

/**
 * Group patterns by pattern ID.
 * @param patterns - Pattern matches to group
 * @returns Map of pattern ID to matches
 */
export function groupPatternsByType(patterns: PatternMatch[]): Map<string, PatternMatch[]> {
  const groups = new Map<string, PatternMatch[]>();

  for (const pattern of patterns) {
    const existing = groups.get(pattern.patternId) || [];
    existing.push(pattern);
    groups.set(pattern.patternId, existing);
  }

  return groups;
}

/**
 * Count the number of nodes participating in a pattern.
 */
function countPatternNodes(roles: Record<string, string | string[]>): number {
  let count = 0;
  for (const value of Object.values(roles)) {
    if (Array.isArray(value)) {
      count += value.length;
    } else {
      count += 1;
    }
  }
  return count;
}

/**
 * Generate pattern summary for display.
 * @param pattern - Pattern match to summarize
 * @returns Human-readable summary string
 */
export function formatPatternSummary(pattern: PatternMatch): string {
  const percentage = Math.round(pattern.confidence * 100);
  const nodeCount = countPatternNodes(pattern.roles);
  const roleCount = Object.keys(pattern.roles).length;

  return `${pattern.patternId} (${percentage}% confidence, ${roleCount} roles, ${nodeCount} nodes)`;
}

/**
 * Pattern panel implementation.
 */
class PatternPanelImpl implements PatternPanel {
  private props: PatternPanelProps;
  private container: HTMLElement | null = null;
  private eventListeners: Array<{ element: HTMLElement; type: string; handler: EventListener }> = [];

  constructor(props: PatternPanelProps) {
    this.props = { ...props };
  }

  /**
   * Render the panel to a container.
   */
  render(container: HTMLElement): void {
    this.container = container;
    this.updateDOM();
    this.attachEventListeners();
  }

  /**
   * Update the panel state.
   */
  update(props: Partial<PatternPanelProps>): void {
    if (props.patterns !== undefined) {
      this.props.patterns = props.patterns;
    }
    if (props.highlightedPattern !== undefined) {
      this.props.highlightedPattern = props.highlightedPattern;
    }
    if (props.onPatternSelect !== undefined) {
      this.props.onPatternSelect = props.onPatternSelect;
    }
    if (props.onClearHighlight !== undefined) {
      this.props.onClearHighlight = props.onClearHighlight;
    }
    if (props.groupByPattern !== undefined) {
      this.props.groupByPattern = props.groupByPattern;
    }

    if (this.container) {
      this.updateDOM();
      this.attachEventListeners();
    }
  }

  /**
   * Get grouped patterns by pattern ID.
   */
  getGroupedPatterns(): Map<string, PatternMatch[]> {
    return groupPatternsByType(this.props.patterns);
  }

  /**
   * Destroy the panel.
   */
  destroy(): void {
    this.removeEventListeners();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
  }

  /**
   * Update the DOM content.
   */
  private updateDOM(): void {
    if (!this.container) return;

    const { patterns, highlightedPattern, groupByPattern } = this.props;

    if (patterns.length === 0) {
      this.container.innerHTML = `
        <div class="pattern-panel empty">
          <h3 class="pattern-panel-title">Patterns</h3>
          <p class="no-patterns">No patterns detected</p>
        </div>
      `;
      return;
    }

    let contentHtml: string;

    if (groupByPattern) {
      const grouped = this.getGroupedPatterns();
      contentHtml = this.renderGroupedPatterns(grouped, highlightedPattern);
    } else {
      contentHtml = this.renderFlatPatterns(patterns, highlightedPattern);
    }

    this.container.innerHTML = `
      <div class="pattern-panel">
        <h3 class="pattern-panel-title">Patterns (${patterns.length})</h3>
        <button class="clear-highlight-btn" ${!highlightedPattern ? 'disabled' : ''}>
          Clear Highlight
        </button>
        ${contentHtml}
      </div>
    `;
  }

  /**
   * Render patterns grouped by type.
   */
  private renderGroupedPatterns(
    grouped: Map<string, PatternMatch[]>,
    highlightedPattern?: string
  ): string {
    const groups = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    return groups.map(([patternId, matches]) => `
      <div class="pattern-group" data-pattern-type="${patternId}">
        <h4 class="pattern-group-title">${patternId} (${matches.length})</h4>
        <ul class="pattern-list">
          ${matches.map((match) => this.renderPatternItem(match, highlightedPattern)).join('')}
        </ul>
      </div>
    `).join('');
  }

  /**
   * Render patterns as a flat list.
   */
  private renderFlatPatterns(
    patterns: PatternMatch[],
    highlightedPattern?: string
  ): string {
    // Sort by confidence descending
    const sorted = [...patterns].sort((a, b) => b.confidence - a.confidence);

    return `
      <ul class="pattern-list flat">
        ${sorted.map((match) => this.renderPatternItem(match, highlightedPattern)).join('')}
      </ul>
    `;
  }

  /**
   * Render a single pattern item.
   */
  private renderPatternItem(pattern: PatternMatch, highlightedPattern?: string): string {
    const isHighlighted = pattern.instanceId === highlightedPattern;
    const percentage = Math.round(pattern.confidence * 100);
    const nodeCount = countPatternNodes(pattern.roles);
    const roleNames = Object.keys(pattern.roles).join(', ');

    return `
      <li class="pattern-item ${isHighlighted ? 'highlighted' : ''}" data-instance-id="${pattern.instanceId}">
        <div class="pattern-header">
          <span class="pattern-type">${pattern.patternId}</span>
          <span class="pattern-confidence">${percentage}%</span>
        </div>
        <div class="pattern-details">
          <span class="pattern-roles">${roleNames}</span>
          <span class="pattern-nodes">${nodeCount} nodes</span>
        </div>
        ${pattern.explain ? `<div class="pattern-explain">${pattern.explain}</div>` : ''}
      </li>
    `;
  }

  /**
   * Attach event listeners.
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Remove existing listeners first
    this.removeEventListeners();

    // Pattern item clicks
    const patternItems = this.container.querySelectorAll('.pattern-item');
    patternItems.forEach((item) => {
      const handler = (e: Event) => {
        const element = e.currentTarget as HTMLElement;
        const instanceId = element.dataset.instanceId;
        if (instanceId) {
          this.props.onPatternSelect(instanceId);
        }
      };
      item.addEventListener('click', handler);
      this.eventListeners.push({
        element: item as HTMLElement,
        type: 'click',
        handler: handler as EventListener,
      });
    });

    // Clear highlight button
    const clearBtn = this.container.querySelector('.clear-highlight-btn');
    if (clearBtn) {
      const handler = () => {
        this.props.onClearHighlight();
      };
      clearBtn.addEventListener('click', handler);
      this.eventListeners.push({
        element: clearBtn as HTMLElement,
        type: 'click',
        handler: handler as EventListener,
      });
    }
  }

  /**
   * Remove event listeners.
   */
  private removeEventListeners(): void {
    for (const { element, type, handler } of this.eventListeners) {
      element.removeEventListener(type, handler);
    }
    this.eventListeners = [];
  }
}

/**
 * Create a pattern panel controller.
 */
export function createPatternPanel(props: PatternPanelProps): PatternPanel {
  return new PatternPanelImpl(props);
}
