"""
TEME Core Module

Contains the deterministic engine, optimizer, sequestration/survival
curve generators, land constraint calculator, and custom exceptions.

All components in this module are pure-math, no ML dependencies.

Usage:
    from teme.core.engine import run_teme
    from teme.core.sequestration import generate_sequestration_curve
    from teme.core.survival import generate_survival_curve
    from teme.core.land import calculate_land_required
    from teme.core.optimizer import select_species_rule_based
    from teme.core.exceptions import TEMEError, InfeasiblePlanError
"""