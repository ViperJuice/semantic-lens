#!/usr/bin/env python3
"""
Python client for Semantic Lens visualization navigation.

This module provides a programmatic API for AI agents to navigate
code visualizations rendered in the browser. It communicates with
the demo-sigma.html viewer via HTTP endpoints (when view-service is running)
or can be used with Playwright for direct browser automation.

Usage:
    from tools.semantic_lens import SemanticLensClient

    # Using HTTP API (requires view-service running)
    client = SemanticLensClient()
    client.zoom_to("galaxy")
    dirs = client.get_directory_tree()

    # Using Playwright for direct browser control
    client = SemanticLensClient(mode="playwright", page=page)
    client.navigate_to_directory("src/auth")
"""

import json
from dataclasses import dataclass
from typing import List, Dict, Optional, Any, Literal, Union

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    from playwright.sync_api import Page
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False


@dataclass
class NodeInfo:
    """Information about a graph node."""
    id: str
    label: str
    kind: str
    file: str
    x: float
    y: float


@dataclass
class DirectoryInfo:
    """Information about a directory in the hierarchy."""
    path: str
    label: str
    node_count: int
    x: float
    y: float


SemanticLevel = Literal["universe", "galaxy", "system", "planet"]


class SemanticLensClient:
    """
    Client for AI agent navigation of code visualizations.

    Supports two modes:
    - "http": Communicates with view-service HTTP API (default)
    - "playwright": Direct browser automation via Playwright

    Semantic Zoom Levels:
    - universe: Directory-level view (ratio > 5.0)
    - galaxy: File-level view (ratio 2.0-5.0)
    - system: Class/module-level view (ratio 0.5-2.0)
    - planet: Full detail view (ratio < 0.5)
    """

    def __init__(
        self,
        base_url: str = "http://localhost:3001",
        mode: Literal["http", "playwright"] = "http",
        page: Optional["Page"] = None
    ):
        """
        Initialize the client.

        Args:
            base_url: Base URL for the HTTP API (only used in http mode)
            mode: "http" for API communication, "playwright" for browser automation
            page: Playwright Page object (required for playwright mode)
        """
        self.base_url = base_url.rstrip("/")
        self.mode = mode
        self.page = page

        if mode == "http" and not HAS_REQUESTS:
            raise ImportError("requests library required for http mode: pip install requests")

        if mode == "playwright":
            if not HAS_PLAYWRIGHT:
                raise ImportError("playwright required for playwright mode: pip install playwright")
            if page is None:
                raise ValueError("page argument required for playwright mode")

    def _http_get(self, endpoint: str) -> Dict[str, Any]:
        """Make HTTP GET request."""
        response = requests.get(f"{self.base_url}{endpoint}", timeout=30)
        response.raise_for_status()
        return response.json()

    def _http_post(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Make HTTP POST request."""
        response = requests.post(
            f"{self.base_url}{endpoint}",
            json=data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        response.raise_for_status()
        return response.json()

    def _js_eval(self, script: str) -> Any:
        """Evaluate JavaScript in the browser."""
        return self.page.evaluate(script)

    # ========================================
    # Semantic Zoom Navigation
    # ========================================

    def get_semantic_level(self) -> SemanticLevel:
        """
        Get current semantic zoom level.

        Returns:
            One of: "universe", "galaxy", "system", "planet"
        """
        if self.mode == "playwright":
            return self._js_eval("window.semanticLens.getSemanticLevel()")
        else:
            result = self._http_get("/navigation/level")
            return result.get("level", "planet")

    def zoom_to(self, level: SemanticLevel) -> bool:
        """
        Zoom to a semantic level.

        Args:
            level: Target level - "universe", "galaxy", "system", or "planet"

        Returns:
            True if successful
        """
        if self.mode == "playwright":
            self._js_eval(f"window.semanticLens.zoomToSemanticLevel('{level}')")
            self.page.wait_for_timeout(350)  # Wait for animation
            return True
        else:
            result = self._http_post("/navigation/zoom", {"level": level})
            return result.get("success", False)

    def navigate_to_directory(self, dir_path: str) -> bool:
        """
        Navigate camera to a directory.

        Centers the view on nodes from the specified directory
        and zooms to galaxy level.

        Args:
            dir_path: Directory path (e.g., "src/auth", "lib/utils")

        Returns:
            True if nodes were found and navigation occurred
        """
        if self.mode == "playwright":
            result = self._js_eval(f"window.semanticLens.navigateToDirectory('{dir_path}')")
            if result:
                self.page.wait_for_timeout(350)
            return result
        else:
            result = self._http_post("/navigation/directory", {"path": dir_path})
            return result.get("success", False)

    def navigate_to_file(self, file_path: str) -> bool:
        """
        Navigate camera to a file.

        Centers the view on nodes from the specified file,
        selects them, and zooms to system level.

        Args:
            file_path: Full file path (e.g., "src/auth/handler.py")

        Returns:
            True if nodes were found and navigation occurred
        """
        if self.mode == "playwright":
            result = self._js_eval(f"window.semanticLens.navigateToFile('{file_path}')")
            if result:
                self.page.wait_for_timeout(350)
            return result
        else:
            result = self._http_post("/navigation/file", {"path": file_path})
            return result.get("success", False)

    # ========================================
    # Directory Hierarchy
    # ========================================

    def get_directory_tree(self) -> List[DirectoryInfo]:
        """
        Get hierarchical directory structure.

        Returns list of directories sorted by node count (descending).

        Returns:
            List of DirectoryInfo objects
        """
        if self.mode == "playwright":
            data = self._js_eval("window.semanticLens.getDirectoryTree()")
        else:
            data = self._http_get("/navigation/tree")

        return [
            DirectoryInfo(
                path=d.get("path", ""),
                label=d.get("label", ""),
                node_count=d.get("nodeCount", 0),
                x=d.get("x", 0),
                y=d.get("y", 0)
            )
            for d in data
        ]

    # ========================================
    # Node Queries
    # ========================================

    def get_visible_nodes(self) -> List[NodeInfo]:
        """
        Get nodes visible at current zoom level.

        Returns:
            List of NodeInfo objects for currently visible nodes
        """
        if self.mode == "playwright":
            data = self._js_eval("window.semanticLens.getVisibleNodes()")
        else:
            data = self._http_get("/navigation/visible")

        return [
            NodeInfo(
                id=n.get("id", ""),
                label=n.get("label", ""),
                kind=n.get("kind", ""),
                file=n.get("file", ""),
                x=n.get("x", 0),
                y=n.get("y", 0)
            )
            for n in data
        ]

    def find_nodes(
        self,
        kind: Optional[str] = None,
        file: Optional[str] = None,
        name: Optional[str] = None,
        name_pattern: Optional[str] = None
    ) -> List[str]:
        """
        Find nodes matching criteria.

        Args:
            kind: Filter by node kind (e.g., "class", "function", "method")
            file: Filter by file path (partial match)
            name: Filter by exact label match
            name_pattern: Filter by regex pattern on label

        Returns:
            List of matching node IDs
        """
        query = {}
        if kind:
            query["kind"] = kind
        if file:
            query["file"] = file
        if name:
            query["name"] = name
        if name_pattern:
            query["namePattern"] = name_pattern

        if self.mode == "playwright":
            return self._js_eval(f"window.semanticLens.findNodes({json.dumps(query)})")
        else:
            result = self._http_post("/navigation/find", query)
            return result.get("nodeIds", [])

    def get_node_info(self, node_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific node.

        Args:
            node_id: The node ID

        Returns:
            Node attributes dict or None if not found
        """
        if self.mode == "playwright":
            return self._js_eval(f"window.semanticLens.getNodeInfo('{node_id}')")
        else:
            result = self._http_get(f"/navigation/node/{node_id}")
            return result if result else None

    # ========================================
    # Selection
    # ========================================

    def select(self, node_ids: List[str]) -> None:
        """
        Select nodes by ID.

        Args:
            node_ids: List of node IDs to select
        """
        if self.mode == "playwright":
            self._js_eval(f"window.semanticLens.select({json.dumps(node_ids)})")
        else:
            self._http_post("/navigation/select", {"nodeIds": node_ids})

    def get_selected(self) -> List[str]:
        """
        Get currently selected node IDs.

        Returns:
            List of selected node IDs
        """
        if self.mode == "playwright":
            return self._js_eval("window.semanticLens.getSelected()")
        else:
            result = self._http_get("/navigation/selected")
            return result.get("nodeIds", [])

    def clear_selection(self) -> None:
        """Clear all selections."""
        if self.mode == "playwright":
            self._js_eval("window.semanticLens.clearSelection()")
        else:
            self._http_post("/navigation/clear-selection", {})

    # ========================================
    # Camera Control
    # ========================================

    def center_on(self, node_ids: List[str]) -> None:
        """
        Center camera on specified nodes.

        Args:
            node_ids: List of node IDs to center on
        """
        if self.mode == "playwright":
            self._js_eval(f"window.semanticLens.centerOn({json.dumps(node_ids)})")
            self.page.wait_for_timeout(350)
        else:
            self._http_post("/navigation/center", {"nodeIds": node_ids})

    def fit(self) -> None:
        """Fit entire graph in view."""
        if self.mode == "playwright":
            self._js_eval("window.semanticLens.fit()")
            self.page.wait_for_timeout(350)
        else:
            self._http_post("/navigation/fit", {})

    # ========================================
    # Settings
    # ========================================

    def set_semantic_zoom_enabled(self, enabled: bool) -> None:
        """
        Enable or disable semantic zoom.

        Args:
            enabled: True to enable, False to disable
        """
        if self.mode == "playwright":
            self._js_eval(f"window.semanticLens.setSemanticZoomEnabled({'true' if enabled else 'false'})")
        else:
            self._http_post("/navigation/settings", {"semanticZoomEnabled": enabled})

    # ========================================
    # Snapshots
    # ========================================

    def capture_screenshot(self) -> str:
        """
        Capture current view as base64 PNG.

        Returns:
            Base64-encoded PNG image data
        """
        if self.mode == "playwright":
            return self._js_eval("window.semanticLens.snapshot('png')")
        else:
            result = self._http_get("/navigation/screenshot")
            return result.get("image", "")

    def get_snapshot_json(self) -> Dict[str, Any]:
        """
        Get current state as JSON snapshot.

        Returns:
            Dict with timestamp, stats, nodes, and selected nodes
        """
        if self.mode == "playwright":
            return self._js_eval("window.semanticLens.snapshot('json')")
        else:
            return self._http_get("/navigation/snapshot")

    # ========================================
    # Convenience Methods
    # ========================================

    def find_and_focus(self, name: str) -> bool:
        """
        Find a symbol by name and focus on it.

        Searches for nodes with matching label, selects the first match,
        and navigates to its file location.

        Args:
            name: Symbol name to find (exact match)

        Returns:
            True if found and focused, False otherwise
        """
        nodes = self.find_nodes(name=name)
        if nodes:
            info = self.get_node_info(nodes[0])
            if info and info.get("file"):
                return self.navigate_to_file(info["file"])
        return False

    def explore_structure(self) -> Dict[str, Any]:
        """
        Get a summary of the codebase structure.

        Returns:
            Dict with directory tree, node counts by kind, and stats
        """
        dirs = self.get_directory_tree()

        # Get all visible nodes at planet level to count by kind
        current_level = self.get_semantic_level()
        self.zoom_to("planet")
        self.page.wait_for_timeout(500) if self.mode == "playwright" else None

        nodes = self.get_visible_nodes()
        kind_counts = {}
        for node in nodes:
            kind_counts[node.kind] = kind_counts.get(node.kind, 0) + 1

        # Restore previous level
        self.zoom_to(current_level)

        return {
            "directories": [
                {"path": d.path, "label": d.label, "nodes": d.node_count}
                for d in dirs[:20]  # Top 20 directories
            ],
            "node_kinds": kind_counts,
            "total_nodes": len(nodes),
            "total_directories": len(dirs)
        }


# Example usage
if __name__ == "__main__":
    print("Semantic Lens Python Client")
    print("===========================")
    print()
    print("Usage with Playwright (direct browser control):")
    print("  from playwright.sync_api import sync_playwright")
    print("  from tools.semantic_lens import SemanticLensClient")
    print()
    print("  with sync_playwright() as p:")
    print("      browser = p.chromium.launch(headless=False)")
    print("      page = browser.new_page()")
    print("      page.goto('http://localhost:8765/demo-sigma.html')")
    print("      page.wait_for_load_state('networkidle')")
    print()
    print("      # Load a fixture")
    print("      page.select_option('select', 'Book-Vetting.slb')")
    print("      page.wait_for_timeout(5000)  # Wait for graph to load")
    print()
    print("      # Create client and navigate")
    print("      client = SemanticLensClient(mode='playwright', page=page)")
    print()
    print("      # Explore the codebase")
    print("      print(f'Current level: {client.get_semantic_level()}')")
    print()
    print("      # Get directory structure")
    print("      dirs = client.get_directory_tree()")
    print("      for d in dirs[:5]:")
    print("          print(f'{d.path}: {d.node_count} nodes')")
    print()
    print("      # Navigate to universe level (see directories)")
    print("      client.zoom_to('universe')")
    print()
    print("      # Navigate to a specific directory")
    print("      client.navigate_to_directory('src/api')")
    print()
    print("      # Find a class")
    print("      classes = client.find_nodes(kind='class')")
    print("      print(f'Found {len(classes)} classes')")
    print()
    print("      browser.close()")
