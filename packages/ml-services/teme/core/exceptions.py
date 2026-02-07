class TEMEError(Exception):
    """Base exception for TEME engine."""


class InfeasiblePlanError(TEMEError):
    """Raised when no mitigation plan satisfies constraints."""
