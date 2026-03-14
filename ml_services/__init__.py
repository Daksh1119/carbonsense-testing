"""Compatibility package for imports expecting top-level ml_services.

This repository stores the real package under packages/ml_services, but some
entrypoints import modules as ml_services.* while others use
packages.ml_services.*. Expose the same package at the repo root so both
import styles resolve consistently.
"""

from importlib import import_module

_pkg = import_module("packages.ml_services")

# Mirror the real package namespace and submodule search path.
globals().update(_pkg.__dict__)
__all__ = getattr(_pkg, "__all__", [])
__path__ = _pkg.__path__
