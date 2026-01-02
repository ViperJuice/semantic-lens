/**
 * Lens Panel
 * Control panel for configuring graph view lenses.
 */

import type { LensConfig, LensPanelProps } from '../types.js';
import type { EdgeKind, NodeKind } from '../../constants.js';

/**
 * Lens panel controller interface.
 */
export interface LensPanel {
  /** Render the panel to a container */
  render(container: HTMLElement): void;
  /** Update the panel state */
  update(props: Partial<LensPanelProps>): void;
  /** Get the current configuration */
  getConfig(): LensConfig;
  /** Destroy the panel */
  destroy(): void;
}

/**
 * Generate HTML for edge kind toggles.
 * @param kinds - Available edge kinds
 * @param enabled - Currently enabled edge kinds
 * @param onChange - Callback when a toggle changes
 * @returns HTML string
 */
export function renderEdgeKindToggles(
  kinds: EdgeKind[],
  enabled: EdgeKind[],
  onChange: (kind: EdgeKind, isEnabled: boolean) => void
): string {
  if (kinds.length === 0) {
    return '<div class="edge-toggles empty">No edge kinds available</div>';
  }

  const enabledSet = new Set(enabled);

  const toggles = kinds.map((kind) => {
    const isChecked = enabledSet.has(kind);
    const checkedAttr = isChecked ? 'checked' : '';
    return `
      <label class="edge-toggle" data-kind="${kind}">
        <input type="checkbox" name="edge-${kind}" value="${kind}" ${checkedAttr}>
        <span class="edge-kind-label">${kind}</span>
      </label>
    `;
  }).join('\n');

  return `<div class="edge-toggles">${toggles}</div>`;
}

/**
 * Generate HTML for confidence slider.
 * @param value - Current confidence value (0-1)
 * @param onChange - Callback when value changes
 * @returns HTML string
 */
export function renderConfidenceSlider(
  value: number,
  onChange: (value: number) => void
): string {
  const percentage = Math.round(value * 100);
  return `
    <div class="confidence-slider">
      <label for="confidence-input">Min Confidence: <span class="confidence-value">${value}</span></label>
      <input
        type="range"
        id="confidence-input"
        name="confidence"
        min="0"
        max="1"
        step="0.05"
        value="${value}"
      >
      <span class="confidence-percentage">${percentage}%</span>
    </div>
  `;
}

/**
 * Generate HTML for pattern visibility toggle.
 */
function renderPatternToggle(showPatterns: boolean): string {
  const checkedAttr = showPatterns ? 'checked' : '';
  return `
    <div class="pattern-toggle">
      <label>
        <input type="checkbox" name="show-patterns" ${checkedAttr}>
        <span>Show Pattern Overlays</span>
      </label>
    </div>
  `;
}

/**
 * Lens panel implementation.
 */
class LensPanelImpl implements LensPanel {
  private props: LensPanelProps;
  private container: HTMLElement | null = null;
  private eventListeners: Array<{ element: HTMLElement; type: string; handler: EventListener }> = [];

  constructor(props: LensPanelProps) {
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
  update(props: Partial<LensPanelProps>): void {
    if (props.config) {
      this.props.config = { ...props.config };
    }
    if (props.availableEdgeKinds) {
      this.props.availableEdgeKinds = props.availableEdgeKinds;
    }
    if (props.availableNodeKinds) {
      this.props.availableNodeKinds = props.availableNodeKinds;
    }
    if (props.onChange) {
      this.props.onChange = props.onChange;
    }

    if (this.container) {
      this.updateDOM();
      this.attachEventListeners();
    }
  }

  /**
   * Get the current configuration.
   */
  getConfig(): LensConfig {
    return { ...this.props.config };
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

    const { config, availableEdgeKinds } = this.props;

    const html = `
      <div class="lens-panel">
        <h3 class="lens-panel-title">View Lens</h3>

        <section class="lens-section">
          <h4>Edge Types</h4>
          ${renderEdgeKindToggles(availableEdgeKinds, config.edgeKinds, this.handleEdgeToggle.bind(this))}
        </section>

        <section class="lens-section">
          <h4>Confidence Filter</h4>
          ${renderConfidenceSlider(config.minConfidence, this.handleConfidenceChange.bind(this))}
        </section>

        <section class="lens-section">
          <h4>Patterns</h4>
          ${renderPatternToggle(config.showPatterns)}
        </section>
      </div>
    `;

    this.container.innerHTML = html;
  }

  /**
   * Attach event listeners.
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Remove existing listeners first
    this.removeEventListeners();

    // Edge toggles
    const edgeToggles = this.container.querySelectorAll('.edge-toggle input');
    edgeToggles.forEach((toggle) => {
      const handler = (e: Event) => {
        const input = e.target as HTMLInputElement;
        const kind = input.value as EdgeKind;
        this.handleEdgeToggle(kind, input.checked);
      };
      toggle.addEventListener('change', handler);
      this.eventListeners.push({
        element: toggle as HTMLElement,
        type: 'change',
        handler: handler as EventListener,
      });
    });

    // Confidence slider
    const confidenceInput = this.container.querySelector('#confidence-input');
    if (confidenceInput) {
      const handler = (e: Event) => {
        const input = e.target as HTMLInputElement;
        this.handleConfidenceChange(parseFloat(input.value));
      };
      confidenceInput.addEventListener('input', handler);
      this.eventListeners.push({
        element: confidenceInput as HTMLElement,
        type: 'input',
        handler: handler as EventListener,
      });
    }

    // Pattern toggle
    const patternToggle = this.container.querySelector('.pattern-toggle input');
    if (patternToggle) {
      const handler = (e: Event) => {
        const input = e.target as HTMLInputElement;
        this.handlePatternToggle(input.checked);
      };
      patternToggle.addEventListener('change', handler);
      this.eventListeners.push({
        element: patternToggle as HTMLElement,
        type: 'change',
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

  /**
   * Handle edge kind toggle.
   */
  private handleEdgeToggle(kind: EdgeKind, enabled: boolean): void {
    const edgeKinds = [...this.props.config.edgeKinds];
    if (enabled && !edgeKinds.includes(kind)) {
      edgeKinds.push(kind);
    } else if (!enabled) {
      const index = edgeKinds.indexOf(kind);
      if (index !== -1) {
        edgeKinds.splice(index, 1);
      }
    }

    const newConfig: LensConfig = {
      ...this.props.config,
      edgeKinds,
    };
    this.props.config = newConfig;
    this.props.onChange(newConfig);
  }

  /**
   * Handle confidence slider change.
   */
  private handleConfidenceChange(value: number): void {
    const newConfig: LensConfig = {
      ...this.props.config,
      minConfidence: value,
    };
    this.props.config = newConfig;
    this.props.onChange(newConfig);

    // Update display value
    if (this.container) {
      const valueSpan = this.container.querySelector('.confidence-value');
      const percentSpan = this.container.querySelector('.confidence-percentage');
      if (valueSpan) valueSpan.textContent = value.toString();
      if (percentSpan) percentSpan.textContent = `${Math.round(value * 100)}%`;
    }
  }

  /**
   * Handle pattern toggle.
   */
  private handlePatternToggle(show: boolean): void {
    const newConfig: LensConfig = {
      ...this.props.config,
      showPatterns: show,
    };
    this.props.config = newConfig;
    this.props.onChange(newConfig);
  }
}

/**
 * Create a lens panel controller.
 */
export function createLensPanel(props: LensPanelProps): LensPanel {
  return new LensPanelImpl(props);
}
