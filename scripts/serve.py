#!/usr/bin/env python3
"""
Simple HTTP server with automatic port selection.
Finds a free port starting from the preferred port.
"""
import http.server
import socketserver
import socket
import sys
import os

def find_free_port(start_port=8765, max_attempts=10):
    """Find a free port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', port))
                return port
        except OSError:
            continue
    raise RuntimeError(f"No free port found in range {start_port}-{start_port + max_attempts}")

def main():
    # Get preferred port from args or use default
    preferred_port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

    # Find a free port
    port = find_free_port(preferred_port)
    if port != preferred_port:
        print(f"Port {preferred_port} in use, using {port} instead")

    # Change to project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    os.chdir(project_root)

    # Start server
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Serving at http://localhost:{port}")
        print(f"Demo: http://localhost:{port}/demo-sigma.html")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")

if __name__ == "__main__":
    main()
