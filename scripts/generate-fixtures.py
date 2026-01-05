#!/usr/bin/env python3
"""
Generates .slb fixtures for repositories listed in manifest.json using treesitter-chunker.
Usage: python scripts/generate-fixtures.py [--all|--missing] [--tiered]

Supports two formats:
  - .slb: Legacy monolithic format (all nodes in single JSON)
  - .slb2: Tiered format with pre-computed positions for lazy loading
"""

import argparse
import json
import sys
import math
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple

# Use installed treesitter-chunker from PyPI (not local checkout)
# sys.path.insert(0, str(Path.home() / "code" / "treesitter-chunker"))


class TieredBundleExporter:
    """
    Exports chunks into a tiered .slb2 format with pre-computed positions.

    Tiers:
      - universe: Directory aggregate nodes (~50-100 nodes)
      - galaxy: Module/file-level nodes (~1000 nodes)
      - system: Class/function nodes (~10K nodes)
      - planet: All remaining nodes (methods, variables, etc.)

    Each tier has pre-computed positions so the browser skips layout computation.
    """

    # Map chunk kinds to tiers
    # Includes both generic kinds and AST-specific node types
    KIND_TO_TIER = {
        # Generic kinds
        'module': 'galaxy',
        'namespace': 'galaxy',
        'package': 'galaxy',
        'class': 'system',
        'interface': 'system',
        'struct': 'system',
        'enum': 'system',
        'trait': 'system',
        'impl': 'system',
        'function': 'system',
        'method': 'planet',
        'constructor': 'planet',
        'property': 'planet',
        'field': 'planet',
        'variable': 'planet',
        'constant': 'planet',
        'parameter': 'planet',

        # JavaScript/TypeScript AST node types
        'import_statement': 'galaxy',
        'export_statement': 'galaxy',
        'class_declaration': 'system',
        'class_definition': 'system',
        'function_declaration': 'system',
        'function_definition': 'system',
        'arrow_function': 'system',
        'function_expression': 'system',
        'decorated_definition': 'system',  # Python decorated class/function
        'method_definition': 'planet',
        'variable_declarator': 'planet',
        'lexical_declaration': 'planet',
        'assignment_expression': 'planet',

        # Python AST node types
        'import_from_statement': 'galaxy',
        'import_statement': 'galaxy',
        'class_definition': 'system',
        'function_definition': 'system',
        'assignment': 'planet',

        # Rust AST node types
        'use_declaration': 'galaxy',
        'mod_item': 'galaxy',
        'struct_item': 'system',
        'enum_item': 'system',
        'impl_item': 'system',
        'trait_item': 'system',
        'function_item': 'system',
        'let_declaration': 'planet',
        'const_item': 'planet',
    }

    def __init__(self, chunks: list, relationships: list):
        self.chunks = chunks
        self.relationships = relationships
        self.tiers: Dict[str, List] = {
            'universe': [],
            'galaxy': [],
            'system': [],
            'planet': []
        }
        self.positions: Dict[str, Dict[str, Tuple[float, float]]] = {
            'universe': {},
            'galaxy': {},
            'system': {},
            'planet': {}
        }
        self.parent_maps: Dict[str, Dict[str, str]] = {
            'galaxy': {},
            'system': {},
            'planet': {}
        }
        self.dir_to_chunks: Dict[str, List] = defaultdict(list)
        self.file_to_chunks: Dict[str, List] = defaultdict(list)

    def _get_tier_for_kind(self, kind: str) -> str:
        """Map chunk kind/node_type to tier name."""
        # Handle both 'kind' attribute and 'node_type' from treesitter-chunker
        kind_lower = kind.lower() if kind else 'unknown'
        return self.KIND_TO_TIER.get(kind_lower, 'planet')

    def _get_chunk_kind(self, chunk) -> str:
        """Get the kind/type from a chunk, handling different attribute names."""
        # treesitter-chunker uses node_type
        if hasattr(chunk, 'node_type'):
            return chunk.node_type or 'unknown'
        # Our mock chunks use kind
        if hasattr(chunk, 'kind'):
            return chunk.kind or 'unknown'
        return 'unknown'

    def _get_chunk_name(self, chunk) -> str:
        """Get the name from a chunk, handling different attribute names."""
        # Try various attribute names
        if hasattr(chunk, 'name') and chunk.name:
            name = chunk.name
            # Skip generic anonymous names
            if not name.startswith('anon@'):
                return name

        # From qualified_route (e.g., ['class_definition:AuthHandler'])
        if hasattr(chunk, 'qualified_route') and chunk.qualified_route:
            for route_part in reversed(chunk.qualified_route):
                if ':' in route_part:
                    name = route_part.split(':')[-1]
                    if name and not name.startswith('anon@'):
                        return name
                elif route_part and not route_part.startswith('anon@'):
                    return route_part

        # From metadata exports
        if hasattr(chunk, 'metadata') and chunk.metadata:
            exports = chunk.metadata.get('exports', [])
            if exports and exports[0]:
                return exports[0]
            # Try imports for import statements
            imports = chunk.metadata.get('imports', [])
            if imports and imports[0]:
                # For import statements, show what's being imported
                imp = imports[0]
                if '/' in imp:
                    return imp.split('/')[-1]  # Get last path component
                return imp

        # Try to extract meaningful name from file_path + node_type
        if hasattr(chunk, 'file_path') and hasattr(chunk, 'node_type'):
            file_name = chunk.file_path.split('/')[-1]
            base_name = file_name.rsplit('.', 1)[0] if '.' in file_name else file_name
            node_type = chunk.node_type or 'unknown'
            # For imports, show file name
            if 'import' in node_type.lower():
                return f"⬇{base_name}"  # Import indicator
            if 'export' in node_type.lower():
                return f"⬆{base_name}"  # Export indicator
            # Use file name for module-level things
            return base_name

        # Final fallback
        chunk_id = self._get_chunk_id(chunk)
        # Try to extract something useful from chunk_id
        if chunk_id and ':' in chunk_id:
            return chunk_id.split(':')[-1]
        return chunk_id or 'unnamed'

    def _get_chunk_id(self, chunk) -> str:
        """Get the ID from a chunk, handling different attribute names."""
        # treesitter-chunker uses chunk_id
        if hasattr(chunk, 'chunk_id') and chunk.chunk_id:
            return chunk.chunk_id
        # Our mock chunks use node_id
        if hasattr(chunk, 'node_id') and chunk.node_id:
            return chunk.node_id
        return 'unknown'

    def _get_rel_source_id(self, rel) -> str:
        """Get the source ID from a relationship, handling different attribute names."""
        # treesitter-chunker uses source_chunk_id
        if hasattr(rel, 'source_chunk_id'):
            return rel.source_chunk_id
        # Our mock relationships use source_id
        if hasattr(rel, 'source_id'):
            return rel.source_id
        return 'unknown'

    def _get_rel_target_id(self, rel) -> str:
        """Get the target ID from a relationship, handling different attribute names."""
        # treesitter-chunker uses target_chunk_id
        if hasattr(rel, 'target_chunk_id'):
            return rel.target_chunk_id
        # Our mock relationships use target_id
        if hasattr(rel, 'target_id'):
            return rel.target_id
        return 'unknown'

    def _get_rel_kind(self, rel) -> str:
        """Get the kind/type from a relationship, handling different attribute names."""
        # treesitter-chunker uses relationship_type (enum)
        if hasattr(rel, 'relationship_type'):
            rtype = rel.relationship_type
            # Could be an enum or string
            return rtype.value if hasattr(rtype, 'value') else str(rtype)
        # Our mock relationships use kind
        if hasattr(rel, 'kind'):
            return rel.kind
        return 'related'

    def _extract_directory(self, file_path: str, depth: int = 2) -> str:
        """Extract directory path from file path, limited to depth levels."""
        parts = file_path.split('/')
        # Remove filename and hidden directories
        dir_parts = [p for p in parts[:-1] if p and not p.startswith('.')]

        # Use depth levels for directory hierarchy
        # This creates a balanced number of universe nodes
        if len(dir_parts) > 0:
            # Take last 'depth' parts, or all if fewer
            path_parts = dir_parts[-min(depth, len(dir_parts)):]
            return '/'.join(path_parts) if path_parts else 'root'
        return 'root'

    def build_tiers(self) -> None:
        """Categorize all chunks into their respective tiers."""
        for chunk in self.chunks:
            # Index by file and directory
            file_path = chunk.file_path
            dir_path = self._extract_directory(file_path)

            self.file_to_chunks[file_path].append(chunk)
            self.dir_to_chunks[dir_path].append(chunk)

            # Assign to tier based on kind/node_type
            kind = self._get_chunk_kind(chunk)
            tier = self._get_tier_for_kind(kind)
            self.tiers[tier].append(chunk)

        # Create universe tier: aggregate nodes for directories
        self._create_directory_aggregates()

    def _create_directory_aggregates(self) -> None:
        """Create aggregate nodes for the universe tier (directories)."""
        for dir_path, chunks in self.dir_to_chunks.items():
            # Create aggregate node representing this directory
            aggregate = {
                'node_id': f'dir:{dir_path}',
                'name': dir_path.split('/')[-1] if '/' in dir_path else dir_path,
                'kind': 'directory',
                'file': dir_path,
                'full_path': dir_path,
                'node_count': len(chunks),
                'is_aggregate': True,
                'member_files': list(set(c.file_path for c in chunks))
            }
            self.tiers['universe'].append(aggregate)

    def build_parent_maps(self) -> None:
        """Build child->parent mappings for hierarchical positioning."""
        # Galaxy -> Universe: file belongs to directory
        for chunk in self.tiers['galaxy']:
            file_path = chunk.file_path
            dir_path = self._extract_directory(file_path)
            chunk_id = self._get_chunk_id(chunk)
            self.parent_maps['galaxy'][chunk_id] = f'dir:{dir_path}'

        # System -> Galaxy: class/function belongs to file (module)
        file_to_module = {}
        for chunk in self.tiers['galaxy']:
            file_to_module[chunk.file_path] = self._get_chunk_id(chunk)

        for chunk in self.tiers['system']:
            file_path = chunk.file_path
            chunk_id = self._get_chunk_id(chunk)
            if file_path in file_to_module:
                self.parent_maps['system'][chunk_id] = file_to_module[file_path]

        # Planet -> System: method belongs to class
        # Use parent_id from chunk metadata if available
        for chunk in self.tiers['planet']:
            chunk_id = self._get_chunk_id(chunk)
            if hasattr(chunk, 'parent_id') and chunk.parent_id:
                self.parent_maps['planet'][chunk_id] = chunk.parent_id
            elif hasattr(chunk, 'metadata') and chunk.metadata:
                parent = chunk.metadata.get('parent_id')
                if parent:
                    self.parent_maps['planet'][chunk_id] = parent

    def compute_positions(self, iterations: int = 100) -> None:
        """
        Compute positions for each tier using a simple force-directed layout.

        Uses a hierarchical approach:
        1. Universe tier: Pure force-directed on directories
        2. Galaxy tier: Anchored to parent directory positions
        3. System tier: Anchored to parent module positions
        4. Planet tier: Anchored to parent class positions
        """
        # Universe tier: force-directed layout
        self._compute_tier_layout('universe', iterations=iterations)

        # Galaxy tier: anchored to universe positions
        self._compute_tier_layout('galaxy', parent_positions=self.positions['universe'],
                                  parent_map=self.parent_maps['galaxy'], iterations=iterations//2)

        # System tier: anchored to galaxy positions
        self._compute_tier_layout('system', parent_positions=self.positions['galaxy'],
                                  parent_map=self.parent_maps['system'], iterations=iterations//2)

        # Planet tier: anchored to system positions
        self._compute_tier_layout('planet', parent_positions=self.positions['system'],
                                  parent_map=self.parent_maps['planet'], iterations=iterations//4)

    def _compute_tier_layout(self, tier_name: str,
                              parent_positions: Optional[Dict] = None,
                              parent_map: Optional[Dict] = None,
                              iterations: int = 100) -> None:
        """
        Compute force-directed layout for a tier.

        For very large tiers (>10K nodes), uses fewer iterations and simplified forces
        to keep computation time reasonable.

        If parent_positions provided, nodes are anchored near their parents.
        """
        nodes = self.tiers[tier_name]
        if not nodes:
            return

        n = len(nodes)

        # For very large tiers, skip force-directed layout entirely
        # O(n²) per iteration makes force-directed impractical for >20K nodes
        if n > 20000:
            print(f"   Computing {tier_name} layout ({n} nodes, parent-anchored only - too large for force-directed)...")
            self._compute_parent_anchored_positions(tier_name, nodes, parent_positions, parent_map)
            return
        elif n > 10000:
            iterations = max(10, iterations // 4)  # 10-25 iterations for large tiers
            print(f"   Computing {tier_name} layout ({n} nodes, {iterations} iterations - reduced for speed)...")
        else:
            print(f"   Computing {tier_name} layout ({n} nodes, {iterations} iterations)...")

        # Initialize positions
        positions = {}
        for i, node in enumerate(nodes):
            node_id = node['node_id'] if isinstance(node, dict) else self._get_chunk_id(node)

            # Start near parent if available
            if parent_positions and parent_map and node_id in parent_map:
                parent_id = parent_map[node_id]
                if parent_id in parent_positions:
                    px, py = parent_positions[parent_id]
                    # Add jitter around parent with MUCH larger spread
                    angle = (i * 2.39996) % (2 * math.pi)  # Golden angle
                    # Scale radius by tier: more nodes = larger spread
                    base_radius = 200 + (n / 10)  # Scales with node count
                    radius = base_radius + (i % 20) * 15
                    positions[node_id] = (px + radius * math.cos(angle),
                                          py + radius * math.sin(angle))
                    continue

            # Random initial position in a large circle
            angle = (i * 2.39996) % (2 * math.pi)
            # Much larger spread for universe/galaxy tiers
            base_spread = 500 if tier_name in ['universe', 'galaxy'] else 300
            radius = base_spread * math.sqrt((i + 1) / max(n, 1))
            positions[node_id] = (radius * math.cos(angle), radius * math.sin(angle))

        # Build adjacency for this tier from relationships
        adjacency = defaultdict(set)
        node_ids = set(positions.keys())

        for rel in self.relationships:
            src = self._get_rel_source_id(rel)
            dst = self._get_rel_target_id(rel)
            if src in node_ids and dst in node_ids:
                adjacency[src].add(dst)
                adjacency[dst].add(src)

        # Force-directed iterations (simplified Barnes-Hut approximation)
        # Stronger repulsion for fewer nodes (universe/galaxy need more spread)
        base_repel = 5000.0 if n < 100 else 2000.0 if n < 1000 else 1000.0

        for iteration in range(iterations):
            forces = {nid: [0.0, 0.0] for nid in positions}

            # Repulsion between all nodes (O(n) approximation using grid)
            k_repel = base_repel
            for nid, (x, y) in positions.items():
                for other_id, (ox, oy) in positions.items():
                    if nid == other_id:
                        continue
                    dx = x - ox
                    dy = y - oy
                    dist = math.sqrt(dx*dx + dy*dy) + 0.1
                    # Much larger interaction radius for better spread
                    if dist < 1500:
                        force = k_repel / (dist * dist)
                        forces[nid][0] += (dx / dist) * force
                        forces[nid][1] += (dy / dist) * force

            # Attraction along edges (weaker to allow spread)
            k_attract = 0.005
            for nid in positions:
                for neighbor in adjacency[nid]:
                    if neighbor in positions:
                        x, y = positions[nid]
                        ox, oy = positions[neighbor]
                        dx = ox - x
                        dy = oy - y
                        dist = math.sqrt(dx*dx + dy*dy) + 0.1
                        force = k_attract * dist
                        forces[nid][0] += (dx / dist) * force
                        forces[nid][1] += (dy / dist) * force

            # Very weak gravity toward center (or parent) - let repulsion dominate
            k_gravity = 0.01 if parent_positions else 0.005
            for nid, (x, y) in positions.items():
                cx, cy = 0, 0
                if parent_positions and parent_map and nid in parent_map:
                    parent_id = parent_map[nid]
                    if parent_id in parent_positions:
                        cx, cy = parent_positions[parent_id]

                forces[nid][0] += k_gravity * (cx - x)
                forces[nid][1] += k_gravity * (cy - y)

            # Apply forces with cooling
            cooling = 1.0 - (iteration / iterations)
            max_displacement = 100 * cooling  # Larger displacement allowed

            for nid in positions:
                fx, fy = forces[nid]
                mag = math.sqrt(fx*fx + fy*fy) + 0.1
                # Limit displacement
                displacement = min(mag, max_displacement)
                x, y = positions[nid]
                positions[nid] = (x + (fx / mag) * displacement,
                                  y + (fy / mag) * displacement)

        self.positions[tier_name] = positions

    def _compute_parent_anchored_positions(self, tier_name: str, nodes: list,
                                           parent_positions: Optional[Dict],
                                           parent_map: Optional[Dict]) -> None:
        """
        Fast O(n) positioning for very large tiers.

        Simply positions each node near its parent with deterministic jitter.
        No force-directed refinement - just hierarchical clustering.
        """
        import random
        positions = {}

        # Group nodes by parent for cluster layout
        parent_to_nodes = {}
        orphan_nodes = []

        for node in nodes:
            node_id = node['node_id'] if isinstance(node, dict) else self._get_chunk_id(node)
            if parent_map and node_id in parent_map:
                parent_id = parent_map[node_id]
                if parent_id not in parent_to_nodes:
                    parent_to_nodes[parent_id] = []
                parent_to_nodes[parent_id].append(node_id)
            else:
                orphan_nodes.append(node_id)

        # Position nodes around their parents with much larger spread
        for parent_id, child_ids in parent_to_nodes.items():
            if parent_positions and parent_id in parent_positions:
                px, py = parent_positions[parent_id]
            else:
                # Parent not positioned - spread out more
                px, py = random.uniform(-1000, 1000), random.uniform(-1000, 1000)

            # Arrange children in a spiral around parent with MUCH larger spread
            n_children = len(child_ids)
            # Base radius scales with number of children for better visibility
            base_radius = max(100, 30 * math.sqrt(n_children))

            for i, child_id in enumerate(child_ids):
                # Use golden angle spiral for better distribution
                angle = i * 2.39996 + (hash(parent_id) % 100) / 100 * math.pi
                # Spiral outward: radius increases with index
                spiral_factor = 1.0 + (i / max(n_children, 1)) * 0.5
                jitter = random.uniform(0.9, 1.1)
                r = base_radius * spiral_factor * jitter
                x = px + r * math.cos(angle)
                y = py + r * math.sin(angle)
                positions[child_id] = (x, y)

        # Position orphan nodes in a large grid with good spacing
        n_orphans = len(orphan_nodes)
        if n_orphans > 0:
            grid_size = int(math.sqrt(n_orphans)) + 1
            spacing = 100  # Larger spacing for visibility
            # Center the orphan grid
            offset_x = -grid_size * spacing / 2 + 2000  # Offset from main graph
            offset_y = -grid_size * spacing / 2
            for i, node_id in enumerate(orphan_nodes):
                row = i // grid_size
                col = i % grid_size
                x = offset_x + col * spacing + random.uniform(-20, 20)
                y = offset_y + row * spacing + random.uniform(-20, 20)
                positions[node_id] = (x, y)

        self.positions[tier_name] = positions

    def export(self, output_path: Path) -> None:
        """Export tiered bundle to .slb2 file."""
        # Build tiers and compute positions
        self.build_tiers()
        self.build_parent_maps()
        self.compute_positions()

        # Build output structure
        bundle = {
            'version': 'v2.0',
            'meta': {
                'total_nodes': len(self.chunks),
                'total_edges': len(self.relationships),
                'generated': datetime.now().isoformat(),
                'tiers': ['universe', 'galaxy', 'system', 'planet'],
                'tier_counts': {
                    tier: len(nodes) for tier, nodes in self.tiers.items()
                }
            }
        }

        # Export each tier
        for tier_name in ['universe', 'galaxy', 'system', 'planet']:
            tier_data = {
                'nodes': [],
                'edges': [],
                'positions': {}
            }

            # Add parent_map for non-universe tiers
            if tier_name != 'universe':
                tier_data['parent_map'] = self.parent_maps[tier_name]

            # Convert nodes
            node_ids_in_tier = set()
            for node in self.tiers[tier_name]:
                if isinstance(node, dict):
                    # Directory aggregate
                    node_data = node.copy()
                else:
                    # Chunk object - use helper methods to handle attribute differences
                    node_data = {
                        'node_id': self._get_chunk_id(node),
                        'name': self._get_chunk_name(node),
                        'kind': self._get_chunk_kind(node),
                        'file': node.file_path,
                        'start_line': node.start_line if hasattr(node, 'start_line') else 0,
                        'end_line': node.end_line if hasattr(node, 'end_line') else 0,
                    }

                tier_data['nodes'].append(node_data)
                node_ids_in_tier.add(node_data['node_id'])

            # Add positions
            for node_id, (x, y) in self.positions[tier_name].items():
                tier_data['positions'][node_id] = {'x': round(x, 2), 'y': round(y, 2)}

            # Filter edges for this tier (edges where both endpoints are in this tier)
            for rel in self.relationships:
                src = self._get_rel_source_id(rel)
                dst = self._get_rel_target_id(rel)
                if src in node_ids_in_tier and dst in node_ids_in_tier:
                    tier_data['edges'].append({
                        'src': src,
                        'dst': dst,
                        'kind': self._get_rel_kind(rel)
                    })

            bundle[tier_name] = tier_data

        # Write to file
        with open(output_path, 'w') as f:
            json.dump(bundle, f, indent=None)  # Compact JSON for smaller file size

        print(f"   Exported {output_path.name}: {output_path.stat().st_size:,} bytes")
        for tier in ['universe', 'galaxy', 'system', 'planet']:
            print(f"      {tier}: {len(bundle[tier]['nodes'])} nodes, {len(bundle[tier]['edges'])} edges")


try:
    from chunker import chunk_file
    from chunker.export.formats.semantic_lens import SemanticLensExporter
    from chunker.export.relationships import ASTRelationshipTracker
except ImportError as e:
    print(f"Error importing chunker: {e}")
    print("Make sure treesitter-chunker is installed:")
    print("  cd ~/code/treesitter-chunker && uv pip install -e .")
    sys.exit(1)

# Directories to skip during scanning
SKIP_DIRECTORIES = {
    '.git', '.venv', '.env', 'node_modules', '__pycache__',
    '.pytest_cache', '.mypy_cache', '.tox', 'venv', 'env',
    '.eggs', 'build', 'dist', '.gradle', 'target'
}

# Language detection based on file extension
# Note: C/C++ disabled due to metadata format incompatibility in treesitter-chunker
EXTENSION_TO_LANGUAGE = {
    '.py': 'python',
    '.js': 'javascript',
    '.ts': 'javascript',  # TypeScript uses javascript parser
    '.tsx': 'javascript',
    '.jsx': 'javascript',
    '.rs': 'rust',
    '.go': 'go',
    # '.java': 'java',  # Disabled - untested
    # '.c': 'c',        # Disabled - metadata format incompatibility
    # '.h': 'c',
    # '.cpp': 'cpp',    # Disabled - metadata format incompatibility
    # '.cc': 'cpp',
    # '.cxx': 'cpp',
    # '.hpp': 'cpp',
    # '.rb': 'ruby',    # Disabled - untested
}


def extract_intra_file_relationships(chunks: list) -> list:
    """
    Extract relationships only within the same file (O(n) per file).
    This is much faster than full extraction for large codebases.
    """
    from collections import defaultdict

    # Group chunks by file
    chunks_by_file = defaultdict(list)
    for chunk in chunks:
        chunks_by_file[chunk.file_path].append(chunk)

    # Use tracker for each file independently
    tracker = ASTRelationshipTracker()
    all_relationships = []
    total_files = len(chunks_by_file)
    processed = 0

    for file_path, file_chunks in chunks_by_file.items():
        processed += 1
        if processed % 100 == 0:
            print(f"      Processing file {processed}/{total_files}...", flush=True)

        if len(file_chunks) <= 1:
            continue
        # Process only this file's chunks
        tracker._relationships = []
        tracker._chunk_index = {}
        tracker._build_chunk_index(file_chunks)
        tracker._analyze_file_chunks(file_chunks, file_chunks)
        all_relationships.extend(tracker._relationships)

    return all_relationships


def extract_hybrid_relationships(chunks: list) -> list:
    """
    Hybrid approach: full intra-file + sampled cross-file relationships.
    Samples cross-file from the top N most connected files.
    """
    from collections import defaultdict, Counter

    # Step 1: Get all intra-file relationships
    relationships = extract_intra_file_relationships(chunks)

    # Step 2: Build file-level connectivity to find hub files
    file_references = Counter()  # How many times each file is referenced

    for chunk in chunks:
        # Look for import-like patterns in chunk names
        if hasattr(chunk, 'metadata') and chunk.metadata:
            imports = chunk.metadata.get('imports', [])
            for imp in imports:
                file_references[imp] += 1

    # Step 3: Get top 100 most-referenced files for cross-file analysis
    top_files = set(f for f, _ in file_references.most_common(100))

    # Group chunks
    chunks_by_file = defaultdict(list)
    for chunk in chunks:
        chunks_by_file[chunk.file_path].append(chunk)

    # Step 4: Extract cross-file relationships for hub files
    hub_chunks = []
    for file_path in top_files:
        if file_path in chunks_by_file:
            hub_chunks.extend(chunks_by_file[file_path])

    if hub_chunks:
        tracker = ASTRelationshipTracker()
        cross_file = tracker.infer_relationships(hub_chunks)

        # Filter to only cross-file relationships (avoid duplicates with intra-file)
        # Use helper to handle different attribute names
        def get_rel_ids(r):
            src = r.source_chunk_id if hasattr(r, 'source_chunk_id') else r.source_id
            dst = r.target_chunk_id if hasattr(r, 'target_chunk_id') else r.target_id
            return (src, dst)

        existing = set(get_rel_ids(r) for r in relationships)
        for rel in cross_file:
            if get_rel_ids(rel) not in existing:
                relationships.append(rel)

    return relationships


def generate_fixture(repo_name: str, repo_path: Path, output_path: Path,
                     verbose: bool = False, tiered: bool = False) -> bool:
    """Generate a .slb (or .slb2 if tiered=True) fixture for a repository."""
    try:
        print(f"⚙ Generating fixture for {repo_name}...")
        print(f"   Path: {repo_path}")
        print(f"   Output: {output_path}")

        # Process repository
        chunks = []

        file_count = 0
        for file_path in repo_path.rglob("*"):
            # Skip specific directories (build artifacts, venvs, etc.)
            if any(part in SKIP_DIRECTORIES for part in file_path.parts):
                continue
            if not file_path.is_file():
                continue
            if file_path.suffix in [".pyc", ".so", ".dylib", ".dll"]:
                continue

            # Detect language from file extension
            language = EXTENSION_TO_LANGUAGE.get(file_path.suffix.lower())
            if not language:
                continue  # Skip files without known language

            try:
                file_chunks = chunk_file(str(file_path), language)
                chunks.extend(file_chunks)
                file_count += 1
            except Exception as err:
                # Log errors in verbose mode, otherwise skip silently
                if verbose:
                    print(f"     ⚠ Error in {file_path.relative_to(repo_path)}: {err}")
                continue

        print(f"   Processed {file_count} files, {len(chunks)} chunks")

        # Extract relationships between chunks
        # Note: Relationship extraction can be slow for very large codebases (O(n²) complexity)
        if len(chunks) > 100000:
            # Massive codebase: skip relationship extraction entirely for speed
            print(f"   ⚠ Massive codebase ({len(chunks)} chunks): skipping relationship extraction")
            relationships = []
            print(f"   (edges will be empty, structure only)")
        elif len(chunks) > 10000:
            # Very large codebase: extract only intra-file relationships (fast)
            print(f"   ⚠ Large codebase ({len(chunks)} chunks): extracting intra-file relationships only")
            relationships = extract_intra_file_relationships(chunks)
            print(f"   Found {len(relationships)} intra-file relationships")
        elif len(chunks) > 3000:
            # Medium-large codebase: full intra-file + sampled cross-file
            print(f"   ⚠ Medium codebase ({len(chunks)} chunks): using hybrid approach")
            relationships = extract_hybrid_relationships(chunks)
            print(f"   Found {len(relationships)} relationships (hybrid)")
        else:
            print(f"   Extracting relationships...")
            tracker = ASTRelationshipTracker()
            relationships = tracker.infer_relationships(chunks)
            print(f"   Found {len(relationships)} relationships")

        # Export to Semantic Lens format
        if tiered:
            # Use tiered exporter for .slb2 format with pre-computed positions
            print(f"   Using tiered export (lazy loading format)...")
            exporter = TieredBundleExporter(chunks, relationships)
            exporter.export(output_path)
            print(f"✓ Generated {repo_name}.slb2 ({output_path.stat().st_size:,} bytes)")
        else:
            # Use standard exporter for .slb format
            exporter = SemanticLensExporter()
            exporter.export(chunks, relationships, output_path)
            print(f"✓ Generated {repo_name}.slb ({output_path.stat().st_size:,} bytes)")

        return True

    except Exception as err:
        import traceback
        ext = '.slb2' if tiered else '.slb'
        print(f"✗ Failed to generate {repo_name}{ext}: {err}")
        if verbose:
            traceback.print_exc()
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate Semantic Lens fixtures")
    parser.add_argument(
        "mode",
        nargs="?",
        default="missing",
        choices=["all", "missing"],
        help="Generation mode (default: missing)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Show detailed error messages for failed files",
    )
    parser.add_argument(
        "-t", "--tiered",
        action="store_true",
        help="Generate .slb2 tiered format with pre-computed positions (for lazy loading)",
    )
    parser.add_argument(
        "-r", "--repo",
        type=str,
        help="Generate fixture for a specific repo only (by name)",
    )
    args = parser.parse_args()

    # Paths
    project_root = Path(__file__).parent.parent
    fixtures_dir = project_root / "fixtures"
    manifest_file = fixtures_dir / "manifest.json"

    # Load manifest
    if not manifest_file.exists():
        print(f"Error: Manifest not found at {manifest_file}")
        print("Run: node scripts/generate-fixture-manifest.js ~/code")
        sys.exit(1)

    with open(manifest_file) as f:
        manifest = json.load(f)

    print("Semantic Lens Fixture Generator")
    print(f"Mode: {args.mode}")
    print(f"Format: {'tiered (.slb2)' if args.tiered else 'standard (.slb)'}")
    print(f"Manifest: {manifest_file}")
    print(f"Output: {fixtures_dir}")
    print()

    # Determine file extension
    ext = '.slb2' if args.tiered else '.slb'

    # Process repositories
    success_count = 0
    skip_count = 0
    fail_count = 0

    for repo in manifest["repos"]:
        repo_name = repo["name"]
        repo_path = Path(repo["path"])
        has_fixture = repo.get("hasFixture", False)
        fixture_path = fixtures_dir / f"{repo_name}{ext}"

        # Skip if specific repo requested and this isn't it
        if args.repo and repo_name != args.repo:
            continue

        # Skip if fixture exists and mode is "missing"
        # For tiered mode, check for .slb2 file existence
        if args.mode == "missing":
            if args.tiered and fixture_path.exists():
                print(f"⊘ Skipping {repo_name} (tiered fixture exists)")
                skip_count += 1
                continue
            elif not args.tiered and has_fixture:
                print(f"⊘ Skipping {repo_name} (fixture exists)")
                skip_count += 1
                continue

        # Skip if repo directory doesn't exist
        if not repo_path.exists():
            print(f"✗ Skipping {repo_name} (directory not found: {repo_path})")
            skip_count += 1
            continue

        # Generate fixture
        if generate_fixture(repo_name, repo_path, fixture_path, args.verbose, args.tiered):
            success_count += 1
        else:
            fail_count += 1

        print()

    # Summary
    print("Done!")
    print(f"  Generated: {success_count}")
    print(f"  Skipped: {skip_count}")
    print(f"  Failed: {fail_count}")
    print()
    print("Run: node scripts/generate-fixture-manifest.js ~/code")
    print("     to update the manifest with new fixtures")


if __name__ == "__main__":
    main()
