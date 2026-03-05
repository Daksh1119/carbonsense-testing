"""
TEME (Tree-based Emission Mitigation Engine)

A deterministic, constraint-aware decision engine that selects viable
tree species, simulates sequestration over time, applies survival decay,
and determines carbon neutrality year.

Hybrid deterministic + optional ML refinement architecture.

Usage:
    from teme.core.engine import run_teme
    from teme.core.exceptions import TEMEError, InfeasiblePlanError
"""

__version__ = "0.1.0"