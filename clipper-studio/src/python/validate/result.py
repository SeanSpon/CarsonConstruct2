"""
Validation result types for Clipper Studio.
"""

from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class ErrorSeverity(Enum):
    """Severity level of validation errors."""
    WARNING = "warning"      # Can be auto-fixed
    ERROR = "error"          # Requires auto-fix
    HARD_FAILURE = "hard"    # Cannot be fixed, clip should be dropped


@dataclass
class ValidationError:
    """A single validation error."""
    code: str                          # Machine-readable error code
    message: str                       # Human-readable message
    severity: ErrorSeverity            # How severe is this error
    field_name: Optional[str] = None   # Which field failed (if applicable)
    details: dict = field(default_factory=dict)  # Additional context
    
    def __str__(self) -> str:
        severity_icon = {
            ErrorSeverity.WARNING: "⚠",
            ErrorSeverity.ERROR: "✗",
            ErrorSeverity.HARD_FAILURE: "✗✗",
        }
        icon = severity_icon.get(self.severity, "?")
        return f"{icon} [{self.code}] {self.message}"


@dataclass
class ValidationResult:
    """Result of validating a single item (clip, caption, etc.)."""
    valid: bool                                    # Overall pass/fail
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
    item_id: Optional[str] = None                  # ID of validated item
    validator_name: str = ""                       # Which validator ran
    
    @property
    def has_warnings(self) -> bool:
        return len(self.warnings) > 0
    
    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0
    
    @property
    def has_hard_failures(self) -> bool:
        return any(e.severity == ErrorSeverity.HARD_FAILURE for e in self.errors)
    
    @property
    def fixable(self) -> bool:
        """Can this be fixed by auto-fix?"""
        return not self.valid and not self.has_hard_failures
    
    def add_error(self, code: str, message: str, severity: ErrorSeverity = ErrorSeverity.ERROR,
                  field: Optional[str] = None, **details):
        """Add an error to this result."""
        error = ValidationError(
            code=code,
            message=message,
            severity=severity,
            field_name=field,
            details=details
        )
        if severity == ErrorSeverity.WARNING:
            self.warnings.append(error)
        else:
            self.errors.append(error)
            self.valid = False
    
    def merge(self, other: 'ValidationResult') -> 'ValidationResult':
        """Merge another result into this one."""
        self.errors.extend(other.errors)
        self.warnings.extend(other.warnings)
        if not other.valid:
            self.valid = False
        return self
    
    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "valid": self.valid,
            "item_id": self.item_id,
            "validator": self.validator_name,
            "errors": [
                {
                    "code": e.code,
                    "message": e.message,
                    "severity": e.severity.value,
                    "field": e.field_name,
                    "details": e.details,
                }
                for e in self.errors
            ],
            "warnings": [
                {
                    "code": w.code,
                    "message": w.message,
                    "severity": w.severity.value,
                    "field": w.field_name,
                    "details": w.details,
                }
                for w in self.warnings
            ],
        }
    
    def __str__(self) -> str:
        status = "✓ valid" if self.valid else "✗ invalid"
        lines = [f"[{self.item_id or 'unknown'}] {status}"]
        for error in self.errors:
            lines.append(f"  {error}")
        for warning in self.warnings:
            lines.append(f"  {warning}")
        return "\n".join(lines)
