"""
Shim module for backwards compatibility.

This module re-exports the GATv2 implementation now located in
`gatv2_inference.py` under the historical `braingnn_inference` name so
other modules that import `braingnn_inference` continue to work.
"""

from .gatv2_inference import *  # re-export everything

__all__ = [
    name for name in globals().keys() if not name.startswith("_")
]

