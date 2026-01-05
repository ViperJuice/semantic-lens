/**
 * Snapshot generation for multimodal LLM context.
 * Supports PNG image export and JSON state export.
 */

import type Sigma from 'sigma';
import type { ViewState } from './viewState.js';
import { serializeViewState } from './viewState.js';
import type { SemanticGraph, GraphNodeAttributes } from './buildGraph.js';

/**
 * Options for snapshot generation.
 */
export interface SnapshotOptions {
  /** Output format: 'png' for image, 'json' for structured data */
  format: 'png' | 'json';
  /** Include view state in JSON output */
  includeState?: boolean;
  /** Include only visible nodes in JSON output */
  visibleOnly?: boolean;
  /** Image width for PNG output */
  width?: number;
  /** Image height for PNG output */
  height?: number;
  /** Background color for PNG output */
  backgroundColor?: string;
}

/**
 * JSON snapshot result structure.
 */
export interface JsonSnapshot {
  /** Timestamp of snapshot */
  timestamp: string;
  /** Graph statistics */
  stats: {
    totalNodes: number;
    visibleNodes: number;
    totalEdges: number;
    visibleEdges: number;
    isolateCount: number;
    communityCount: number;
  };
  /** View state (if includeState is true) */
  viewState?: ReturnType<typeof serializeViewState>;
  /** Camera state */
  camera: {
    x: number;
    y: number;
    ratio: number;
    angle: number;
  };
  /** Node data (summary or full depending on options) */
  nodes: NodeSummary[];
  /** Selected node details (always included) */
  selectedDetails: NodeDetail[];
}

/**
 * Summary information about a node (for compact snapshots).
 */
export interface NodeSummary {
  id: string;
  label: string;
  kind: string;
  community?: number;
  selected: boolean;
  visible: boolean;
}

/**
 * Detailed information about a node (for selected nodes).
 */
export interface NodeDetail {
  id: string;
  label: string;
  kind: string;
  file: string;
  route?: string;
  community?: number;
  neighbors: {
    incoming: string[];
    outgoing: string[];
  };
}

/**
 * Captures a snapshot of the current graph visualization.
 */
export async function captureSnapshot(
  sigma: Sigma,
  graph: SemanticGraph,
  state: ViewState,
  options: SnapshotOptions
): Promise<string | JsonSnapshot> {
  if (options.format === 'png') {
    return capturePngSnapshot(sigma, options);
  } else {
    return captureJsonSnapshot(sigma, graph, state, options);
  }
}

/**
 * Captures a PNG image of the current visualization.
 */
async function capturePngSnapshot(sigma: Sigma, options: SnapshotOptions): Promise<string> {
  // Get the Sigma canvas layers
  const layers = sigma.getCanvases();

  // Create a composite canvas
  const width = options.width ?? sigma.getContainer().clientWidth;
  const height = options.height ?? sigma.getContainer().clientHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Draw background
  ctx.fillStyle = options.backgroundColor ?? '#1a1a2e';
  ctx.fillRect(0, 0, width, height);

  // Draw each Sigma layer in order
  const layerOrder = ['edges', 'nodes', 'labels', 'hovers', 'mouse'];
  for (const layerName of layerOrder) {
    const layer = layers[layerName as keyof typeof layers];
    if (layer instanceof HTMLCanvasElement) {
      ctx.drawImage(layer, 0, 0, width, height);
    }
  }

  // Return as data URL
  return canvas.toDataURL('image/png');
}

/**
 * Captures a JSON snapshot of the current visualization state.
 */
function captureJsonSnapshot(
  sigma: Sigma,
  graph: SemanticGraph,
  state: ViewState,
  options: SnapshotOptions
): JsonSnapshot {
  const camera = sigma.getCamera().getState();

  // Count communities
  const communities = new Set<number>();
  let isolateCount = 0;

  graph.forEachNode((nodeId: string, attrs: GraphNodeAttributes) => {
    if (attrs.community !== undefined) {
      communities.add(attrs.community);
    }
    if (attrs.isolate) {
      isolateCount++;
    }
  });

  // Build node summaries
  const nodes: NodeSummary[] = [];
  const selectedDetails: NodeDetail[] = [];

  graph.forEachNode((nodeId: string, attrs: GraphNodeAttributes) => {
    const isVisible = !attrs.hidden;
    const isSelected = state.selectedNodes.has(nodeId);

    // Skip non-visible nodes if visibleOnly
    if (options.visibleOnly && !isVisible) return;

    nodes.push({
      id: nodeId,
      label: attrs.label,
      kind: attrs.kind,
      community: attrs.community,
      selected: isSelected,
      visible: isVisible,
    });

    // Add detailed info for selected nodes
    if (isSelected) {
      const incoming: string[] = [];
      const outgoing: string[] = [];

      graph.forEachInEdge(nodeId, (_edge: string, _edgeAttrs: unknown, src: string) => {
        incoming.push(src);
      });

      graph.forEachOutEdge(nodeId, (_edge: string, _edgeAttrs: unknown, _src: string, dst: string) => {
        outgoing.push(dst);
      });

      selectedDetails.push({
        id: nodeId,
        label: attrs.label,
        kind: attrs.kind,
        file: attrs.file,
        route: attrs.route,
        community: attrs.community,
        neighbors: { incoming, outgoing },
      });
    }
  });

  // Count visible nodes/edges
  let visibleNodes = 0;
  let visibleEdges = 0;

  graph.forEachNode((_nodeId: string, attrs: GraphNodeAttributes) => {
    if (!attrs.hidden) visibleNodes++;
  });

  graph.forEachEdge((_edgeKey: string, attrs: { hidden?: boolean }) => {
    if (!attrs.hidden) visibleEdges++;
  });

  const snapshot: JsonSnapshot = {
    timestamp: new Date().toISOString(),
    stats: {
      totalNodes: graph.order,
      visibleNodes,
      totalEdges: graph.size,
      visibleEdges,
      isolateCount,
      communityCount: communities.size,
    },
    camera: {
      x: camera.x,
      y: camera.y,
      ratio: camera.ratio,
      angle: camera.angle,
    },
    nodes,
    selectedDetails,
  };

  if (options.includeState) {
    snapshot.viewState = serializeViewState(state);
  }

  return snapshot;
}

/**
 * Downloads a snapshot as a file.
 */
export function downloadSnapshot(
  data: string | JsonSnapshot,
  filename: string,
  format: 'png' | 'json'
): void {
  let blob: Blob;
  let finalFilename = filename;

  if (format === 'png') {
    // Convert data URL to blob
    const dataUrl = data as string;
    const byteString = atob(dataUrl.split(',')[1] ?? '');
    const mimeString = dataUrl.split(',')[0]?.split(':')[1]?.split(';')[0] ?? 'image/png';

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    blob = new Blob([ab], { type: mimeString });
    finalFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
  } else {
    const json = JSON.stringify(data, null, 2);
    blob = new Blob([json], { type: 'application/json' });
    finalFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
  }

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
